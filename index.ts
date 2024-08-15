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
}

class BangDiceGame {
    players: Player[] = [];
    arrowLeft: number = 9;

    private getRoles(num: number): Roles[] {
        const roles = [
            Roles.SHERIFF,
            Roles.OUTLAW,
            Roles.OUTLAW,
            Roles.RENEGADE,
            Roles.DEPUTY,
            Roles.OUTLAW,
            Roles.DEPUTY,
            Roles.RENEGADE
        ];

        return shuffle(roles.slice(0, num));
    }

    initPlayers(num: number) {
        const roles = this.getRoles(num);
        this.players = roles.map((role, i) => new Player(`Player ${i + 1}`, role));
    }

    printPlayers() {
        this.players.forEach(player => player.printInfo());
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
}

const shuffle = <T>(array: T[]): T[] => {
    const length = array.length;
    for (let i = length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

main();
