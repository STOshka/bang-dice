import inquirer from 'inquirer';

enum Roles {
    SHERIFF,
    DEPUTY,
    OUTLAW,
    RENEGADE
}

class Player {
    name: string;
    role: Roles;
    maxLife: number;
    life: number;
    arrowCount: number = 0;

    constructor(name: string, role: Roles) {
        this.name = name;
        this.role = role;
        this.maxLife = role === Roles.SHERIFF ? 10 : 8;
        this.life = this.maxLife;
    }

    printInfo() {
        console.log(`${this.name} - ${this.isAlive || this.role === Roles.SHERIFF ? Roles[this.role] : ""} - ${this.life}/${this.maxLife} (Arrows: ${this.arrowCount})`);
    }

    get isAlive(): boolean {
        return this.life > 0;
    }

    receiveDamage(damage: number) {
        this.life -= damage;
    }

    heal(amount: number) {
        this.life = Math.min(this.life + amount, this.maxLife);
    }

    addArrow() {
        this.arrowCount++;
    }

    resetArrows() {
        this.arrowCount = 0;
    }
}

enum DiceFaces {
    NONE,
    ARROW,
    DYNAMITE,
    SHOOT_1,
    SHOOT_2,
    BEER,
    GATLING
}

class Dice {
    faces: DiceFaces[] = [
        DiceFaces.ARROW,
        DiceFaces.DYNAMITE,
        DiceFaces.SHOOT_1,
        DiceFaces.SHOOT_2,
        DiceFaces.BEER,
        DiceFaces.GATLING
    ];
    value: DiceFaces = DiceFaces.NONE;
    isHeld: boolean = false;

    roll() {
        this.value = this.faces[Math.floor(Math.random() * this.faces.length)];
    }
}

class BangDiceGame {
    players: Player[] = [];
    arrowCount: number = 9;
    isFinished: boolean = false;
    currentPlayerIndex: number = -1;
    dices: Dice[] = [];
    rollsLeft: number = 2;

    private getRoles(num: number): Roles[] {
        const allRoles = [
            Roles.SHERIFF,
            Roles.OUTLAW,
            Roles.OUTLAW,
            Roles.RENEGADE,
            Roles.DEPUTY,
            Roles.OUTLAW,
            Roles.DEPUTY,
            Roles.RENEGADE
        ];

        return shuffle(allRoles.slice(0, num));
    }

    initPlayers(num: number) {
        const roles = this.getRoles(num);
        this.players = roles.map((role, i) => new Player(`Player ${i + 1}`, role));
        this.currentPlayerIndex = this.players.findIndex(player => player.role === Roles.SHERIFF);
    }

    printPlayers() {
        this.players.forEach(player => player.printInfo());
    }

    private get currentPlayer(): Player {
        return this.players[this.currentPlayerIndex];
    }

    private addArrowToCurrentPlayer() {
        if (this.turnIsFinished) return;
        const currentPlayer = this.currentPlayer;
        currentPlayer.addArrow();
        this.arrowCount--;

        console.log(`${currentPlayer.name} gains an arrow!`);

        if (this.arrowCount <= 0) {
            console.log(`Indian ATTACK!`);
            this.resolveIndianAttack();
        }
    }

    private resolveIndianAttack() {
        this.players.forEach(player => {
            this.receiveDamage(player, player.arrowCount);
            player.resetArrows();
        });

        this.arrowCount = 9;
    }

    private async handleTurn() {
        const currentPlayer = this.currentPlayer;
        console.log(`Current Player: ${currentPlayer.name}`);
        this.dices = Array.from({ length: 5 }, () => new Dice());
        this.rollsLeft = 2;
        this.rollDices();

        while (this.rollsLeft > 0 && !this.turnIsFinished) {
            console.log(`Rolls left: ${this.rollsLeft}`);
            await this.promptDiceSelection();
            this.rollsLeft--;
            this.rollDices();
        }

        if (!this.turnIsFinished) {
            await this.resolveShooting();
        }
        if (!this.turnIsFinished) {
            this.resolveBeer();
        }
        if (!this.turnIsFinished) {
            this.resolveGatling();
        }
    }

    private alivePlayers() {
        return this.players.filter(player => player.isAlive);
    }

    private getShootingTargets(die: DiceFaces): Player[] {
        const shootingDistance = die === DiceFaces.SHOOT_2 ? 2 : 1;
        const alivePlayers = this.alivePlayers();
        const numAlivePlayers = alivePlayers.length;
        const currentPlayerIdx = this.alivePlayers().findIndex(player => player === this.currentPlayer);

        const forwardTargetIndex = (currentPlayerIdx + shootingDistance) % numAlivePlayers;
        const backwardTargetIndex = (currentPlayerIdx- shootingDistance + numAlivePlayers) % numAlivePlayers;

        const targets = new Set<Player>();

        if (currentPlayerIdx !== forwardTargetIndex) {
            targets.add(alivePlayers[forwardTargetIndex]);
        }

        if (currentPlayerIdx !== backwardTargetIndex) {
            targets.add(alivePlayers[backwardTargetIndex]);
        }

        return [...targets];
    }

    private async chooseTarget(die: DiceFaces) {
        const targets = this.getShootingTargets(die);
        if (targets.length === 1) {
            return targets[0];
        }
        const { player } = await inquirer.prompt([
            {
                type: 'list',
                name: 'player',
                message: `Select player to shoot (${DiceFaces[die]}):`,
                choices: targets.map(target => ({ name: target.name, value: target }))
            },
        ]);
        return player;
    }

    private async resolveShooting() {
        let targets = new Map<Player, number>();
        const shootOne = this.countDiceFaces(DiceFaces.SHOOT_1);

        for (let i = 0; i < shootOne; i++) {
            const target = await this.chooseTarget(DiceFaces.SHOOT_1);
            const dmg = (targets.get(target) || 0) + 1;
            targets.set(target, dmg);
        }

        const shootTwo = this.countDiceFaces(DiceFaces.SHOOT_2);

        for (let i = 0; i < shootTwo; i++) {
            const target = await this.chooseTarget(DiceFaces.SHOOT_2);
            const dmg = (targets.get(target) || 0) + 1;
            targets.set(target, dmg);
        }
        for (const [player, dmg] of targets.entries()) {
            this.receiveDamage(player, dmg);
        }
    }

    private receiveDamage(player: Player, damage: number) {
        if (damage > 0) {
            player.receiveDamage(damage);
            console.log(`${player.name} takes ${damage} damage`);
            this.checkIsAlive(player);
        }
    }

    private checkIsAlive(player: Player) {
        if (player.life <= 0) {
            console.log(`${player.name} died!`);
            this.arrowCount += player.arrowCount;
            player.resetArrows();
            this.checkEndGame();
        }
    }

    private resolveBeer() {
        const beerCount = this.countDiceFaces(DiceFaces.BEER);
        if (beerCount > 0) {
            const currentPlayer = this.currentPlayer;
            currentPlayer.heal(beerCount);
            console.log(`${currentPlayer.name} heals for ${beerCount} HP`);
        }
    }

    private resolveGatling() {
        const gatlingCount = this.countDiceFaces(DiceFaces.GATLING);
        if (gatlingCount >= 3) {
            const currentPlayer = this.currentPlayer;
            console.log(`Gatling! Everyone except ${currentPlayer.name} loses a life. ${currentPlayer.name} loses all their arrows.`);

            this.players.forEach(player => {
                if (player !== currentPlayer && player.isAlive) {
                    this.receiveDamage(player, 1);
                }
            });

            this.arrowCount += currentPlayer.arrowCount;
            currentPlayer.resetArrows();
            this.checkEndGame();
        }
    }

    private checkEndGame() {
        const sheriff = this.players.find(player => player.role === Roles.SHERIFF);
        const badGuys = this.players.filter(player =>
            (player.role === Roles.OUTLAW || player.role === Roles.RENEGADE) && player.isAlive
        );

        if (!sheriff?.isAlive) {
            const alivePlayers = this.players.filter(player => player.isAlive);
            const winner = alivePlayers.length === 1 && alivePlayers[0].role === Roles.RENEGADE
                ? "Renegade"
                : "Outlaws";
            console.log(`Game over! ${winner} win!`);
            this.isFinished = true;
        } else if (badGuys.length === 0) {
            console.log(`Game over! The Law win!`);
            this.isFinished = true;
        }
    }

    private rollDices() {
        this.dices.forEach(dice => {
            if (!dice.isHeld) {
                dice.roll();
            }
        });
        console.log('Rolled Dices:', this.dices.map(dice => DiceFaces[dice.value]));

        this.dices.forEach(dice => {
            if (dice.value === DiceFaces.ARROW) {
                this.addArrowToCurrentPlayer();
            }
        });

        const dynamiteCount = this.countDiceFaces(DiceFaces.DYNAMITE);
        if (dynamiteCount >= 3) {
            console.log(`Dynamite explodes!`);
            this.receiveDamage(this.currentPlayer, 1);
            this.rollsLeft = 0;
        }
    }

    private countDiceFaces(face: DiceFaces): number {
        return this.dices.filter(dice => dice.value === face).length;
    }

    private async promptDiceSelection() {
        const { diceHold } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'diceHold',
                message: 'Select dice to hold (Dynamites are held automatically):',
                choices: this.dices.map((die, index) => ({
                    name: DiceFaces[die.value],
                    value: index,
                    checked: die.isHeld,
                    disabled: die.value === DiceFaces.DYNAMITE,
                })),
            },
        ]);

        this.dices.forEach((die, index) => {
            die.isHeld = diceHold.includes(index) || die.value === DiceFaces.DYNAMITE;
        });
    }

    get turnIsFinished(): boolean {
        return this.isFinished || this.currentPlayer.life <= 0;
    }

    async startGame() {
        while (!this.isFinished) {
            await this.handleTurn();
            this.printPlayers();
            do {
                this.currentPlayerIndex = (this.currentPlayerIndex + 1 + this.players.length) % this.players.length;
            } while (this.players[this.currentPlayerIndex].life <= 0);
        }
    }

}

async function main() {
    const { numberOfPlayers } = await inquirer.prompt([{
        type: 'input',
        name: 'numberOfPlayers',
        message: 'How many players are participating?',
        validate: (input: string) => {
            const parsed = parseInt(input);
            if (isNaN(parsed) || parsed < 4 || parsed > 8) {
                return 'Please enter a number between 4 and 8.';
            }
            return true;
        },
        filter: (input: string) => parseInt(input),
    }]);

    const game = new BangDiceGame();
    game.initPlayers(numberOfPlayers);
    game.printPlayers();
    await game.startGame();
}

const shuffle = <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

main();