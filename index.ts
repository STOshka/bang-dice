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
        console.log(`${this.name} - ${!this.isAlive || this.role === Roles.SHERIFF ? Roles[this.role] : "???"} - ${this.life}/${this.maxLife} (Arrows: ${this.arrowCount})`);
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

    addArrow(count: number = 1) {
        this.arrowCount += count;
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

    private addArrowToCurrentPlayer(arrowsToAdd: number) {
        if (this.turnIsFinished || arrowsToAdd == 0) return;
        const currentPlayer = this.currentPlayer;
        if (arrowsToAdd >= this.arrowCount) {
            const arrowsAvailable = this.arrowCount;
            const remainingToAdd = arrowsToAdd - arrowsAvailable;
            console.log(`${currentPlayer.name} gains ${arrowsAvailable} ${arrowsAvailable === 1 ? 'arrow' : 'arrows'}!`);
            currentPlayer.addArrow(arrowsAvailable);
            this.arrowCount = 0;
            console.log(`Indian ATTACK!`);
            this.resolveIndianAttack();
            this.addArrowToCurrentPlayer(remainingToAdd);
        } else {
            console.log(`${currentPlayer.name} gains ${arrowsToAdd} ${arrowsToAdd === 1 ? 'arrow' : 'arrows'}!`);
            currentPlayer.addArrow(arrowsToAdd);
            this.arrowCount -= arrowsToAdd;
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

        const actions: Array<() => Promise<void> | void> = [
            () => this.resolveShooting(),
            () => this.resolveBeer(),
            () => this.resolveGatling()
        ];
        for (const action of actions) {
            if (this.turnIsFinished) break;
            await action();
        }
    }

    private alivePlayers() {
        return this.players.filter(player => player.isAlive);
    }

    private getShootingTargets(die: DiceFaces): Player[] {
        const alivePlayers = this.alivePlayers();
        const shootingDistances = die === DiceFaces.SHOOT_2 && alivePlayers.length > 3 ? [2] : [1];
        const currentPlayerIdx = alivePlayers.findIndex(player => player === this.currentPlayer);
        
        const targets = new Set<Player>();
        for (const distance of shootingDistances) {
            const indices = [
                (currentPlayerIdx + distance) % alivePlayers.length,
                (currentPlayerIdx - distance + alivePlayers.length) % alivePlayers.length
            ];
          
            indices.forEach(idx => {
                if (idx !== currentPlayerIdx) {
                    targets.add(alivePlayers[idx]);
                }
            });
        }

        return [...targets];
    }

    private async chooseTarget(die: DiceFaces, targets: Player[]) {
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
        const targets = new Map<Player, number>();

        for (const die of [DiceFaces.SHOOT_1, DiceFaces.SHOOT_2]) {
          const count = this.countDiceFaces(die);
          if (count == 0) continue;

          const shootingTargets = this.getShootingTargets(die);
          for (let i = 0; i < count; i++) {
            const target = await this.chooseTarget(die, shootingTargets);
            targets.set(target, (targets.get(target) || 0) + 1);
          }
        }

        for (const [player, dmg] of targets) {
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

    private async resolveBeer() {
        const count = this.countDiceFaces(DiceFaces.BEER);
        if (count == 0) return;

        const targets = new Map<Player, number>();
        const beerTargets = this.alivePlayers();
        for (let i = 0; i < count; i++) {
            const target = await this.chooseTarget(DiceFaces.BEER, beerTargets);
            targets.set(target, (targets.get(target) || 0) + 1);
        }

        for (const [player, beerCount] of targets) {
            player.heal(beerCount);
            console.log(`${player.name} heals for ${beerCount} HP`);
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

        const arrowCount = this.dices.filter(dice => 
            dice.value === DiceFaces.ARROW && !dice.isHeld).length;
        this.addArrowToCurrentPlayer(arrowCount);

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