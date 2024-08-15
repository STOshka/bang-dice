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
    arrow: number = 0;

    constructor(name: string, role: Roles) {
        this.name = name;
        this.role = role;
        this.maxLife = role === Roles.SHERIFF ? 10 : 8;
        this.life = this.maxLife;
    }

    printInfo() {
        console.log(`${this.name} - ${Roles[this.role]} - ${this.life}/${this.maxLife} (Arrow: ${this.arrow})`);
    }

    receiveDamage(damage: number) {
        this.life -= damage;
    }

    heal(amount: number) {
        this.life = Math.min(this.life + amount, this.maxLife);
    }

    addArrow() {
        this.arrow += 1;
    }

    resetArrows() {
        this.arrow = 0;
    }
}

enum DiceFaces {
    NONE,
    ARROW,
    DYNAMITE,
    SHOOT_LEFT,
    SHOOT_RIGHT,
    BEER,
    GATLING
}

class Dice {
    faces: DiceFaces[] = [
        DiceFaces.ARROW,
        DiceFaces.DYNAMITE,
        DiceFaces.SHOOT_LEFT,
        DiceFaces.SHOOT_RIGHT,
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
    arrowLeft: number = 9;
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
        this.currentPlayerIndex = this.players.findIndex(player => player.role === Roles.SHERIFF) - 1;
    }

    printPlayers() {
        this.players.forEach(player => player.printInfo());
    }

    get currentPlayer(): Player {
        return this.players[this.currentPlayerIndex];
    }

    private findPlayerIndex(start: number, dir: number) {
        let _currentIndex = start;
        do {
            _currentIndex = (_currentIndex + dir + this.players.length) % this.players.length;
            console.log(_currentIndex);
        } while (this.players[_currentIndex].life <= 0);
        return _currentIndex;
    }

    private nextPlayerIndex() {
        return this.findPlayerIndex(this.currentPlayerIndex, 1);
    }

    private prevPlayerIndex() {
        return this.findPlayerIndex(this.currentPlayerIndex, -1);
    }

    private addArrowToCurrentPlayer() {
        this.currentPlayer.addArrow();
        this.arrowLeft -= 1;
        console.log(`${this.currentPlayer.name} gains an arrow!`);

        if (this.arrowLeft <= 0) {
            this.resolveArrowRain();
        }
    }

    private resolveArrowRain() {
        this.players.forEach(player => {
            player.receiveDamage(player.arrow);
            player.resetArrows();
        });

        this.arrowLeft = 9;
    }

    private async handleTurn() {
        console.log(`Current Player: ${this.currentPlayer.name}`);
        this.dices = Array.from({ length: 5 }, () => new Dice());
        this.rollsLeft = 2;
        this.rollDices();
        this.checkDynamite();

        while (this.rollsLeft > 0 && !this.turnIsFinished) {
            console.log(`Rolls left: ${this.rollsLeft}`);
            await this.promptDiceSelection();
            this.rollDices();
            this.checkDynamite();
            this.rollsLeft--;
        }

        if (this.turnIsFinished) return;

        this.resolveShooting();
        if (this.turnIsFinished) return;

        this.resolveBeer();
        if (this.turnIsFinished) return;

        this.resolveGatling();
    }

    private resolveShooting() {
        const shootLeft = this.dices.filter(dice => dice.value === DiceFaces.SHOOT_LEFT).length;
        const playerLeft = this.players[this.prevPlayerIndex()];
        playerLeft.receiveDamage(shootLeft);
        if (shootLeft > 0) {
            console.log(`${playerLeft.name} takes ${shootLeft} damage`);
            this.checkIsAlive(playerLeft);
        }

        const shootRight = this.dices.filter(dice => dice.value === DiceFaces.SHOOT_RIGHT).length;
        const playerRight = this.players[this.nextPlayerIndex()];
        playerRight.receiveDamage(shootRight);
        if (shootRight > 0) {
            console.log(`${playerRight.name} takes ${shootRight} damage`);
            this.checkIsAlive(playerRight);
        }
    }

    private checkIsAlive(player: Player) {
        if (player.life <= 0) {
            console.log(`${player.name} died!`)
            this.arrowLeft += player.arrow;
            player.resetArrows();
            this.checkEndGame();
        }
    }

    private resolveBeer() {
        const beerCount = this.dices.filter(dice => dice.value === DiceFaces.BEER).length;
        this.currentPlayer.heal(beerCount);
        console.log(`${this.currentPlayer.name} heals for ${beerCount} HP`);
    }

    private resolveGatling() {
        const gatlingCount = this.dices.filter(dice => dice.value === DiceFaces.GATLING).length;
        if (gatlingCount > 2) {
            console.log(`Gatling! Everyone except ${this.currentPlayer.name} loses a life. ${this.currentPlayer.name} loses all their arrows.`);
            this.players.forEach(player => {
                if (player !== this.currentPlayer && player.life > 0) {
                    player.receiveDamage(1);
                    this.checkIsAlive(player);
                }
            });
            this.arrowLeft += this.currentPlayer.arrow;
            this.currentPlayer.resetArrows();
            this.checkEndGame();
        }
    }

    private checkEndGame() {
        const sheriff = this.players.find(player => player.role === Roles.SHERIFF);
        const badGuys = this.players.filter(player => 
            (player.role === Roles.OUTLAW || player.role === Roles.RENEGADE) && player.life > 0
        );

        if (sheriff!.life <= 0) {
            const alivePlayers = this.players.filter(player => player.life > 0);
            if (alivePlayers.length === 1 && alivePlayers[0].role === Roles.RENEGADE) {
                console.log(`Game over! Renegade wins!`);
            } else {
                console.log(`Game over! Outlaws win!`);
            }
            this.isFinished = true;
        } else if (badGuys.length === 0) {
            console.log(`Game over! The Law wins!`);
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
    }

    private checkDynamite() {
        const dynamiteCount = this.dices.filter(dice => dice.value === DiceFaces.DYNAMITE).length;
        if (dynamiteCount > 2) {
            console.log(`Dynamite explodes! ${this.currentPlayer.name} loses a life!`);
            this.currentPlayer.receiveDamage(1);
            this.rollsLeft = 0;
        }
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
        return this.isFinished || this.currentPlayer?.life <= 0;
    }

    async startGame() {
        while (!this.isFinished) {
            this.currentPlayerIndex = this.nextPlayerIndex();
            await this.handleTurn();
            this.printPlayers();
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