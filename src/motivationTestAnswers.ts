const notSoSecretKey = 'dont give up, keep trying, try it from the other side.';
const numberOfAnswerChoises: number = 7;

class Answers {
    curiosity: number[];
    honor: number[];
    acceptance: number[];
    mastery: number[];
    leadership: number[];
    freedom: number[];
    relatedness: number[];
    order: number[];
    goal: number[];
    status: number[];
    comfort: number[];
    [key: string]: number[];
    constructor() {
        this.curiosity = [];
        this.honor = [];
        this.acceptance = [];
        this.mastery = [];
        this.leadership = [];
        this.freedom = [];
        this.relatedness = [];
        this.order = [];
        this.goal = [];
        this.status = [];
        this.comfort = [];
    }
}

class ResultForBlockchain {
    time: number = 0;
    cur: number = 0;
    hon: number = 0;
    acc: number = 0;
    mas: number = 0;
    lea: number = 0;
    fre: number = 0;
    rel: number = 0;
    ord: number = 0;
    goa: number = 0;
    sta: number = 0;
    com: number = 0;
}

class Result {
    time: number = 0;
    curiosity: number = 0;
    honor: number = 0;
    acceptance: number = 0;
    mastery: number = 0;
    leadership: number = 0;
    freedom: number = 0;
    relatedness: number = 0;
    order: number = 0;
    goal: number = 0;
    status: number = 0;
    comfort: number = 0;
    [key: string]: number;
}

export class motivationTestAnswers {
    private time: number[];
    answers: Answers;
    result: Result;
    constructor() {
        this.time = [];
        this.answers = new Answers;
        this.result = new Result;
    }

    addAnswer(category: string, answer: number) {
        if (category) {
            this.answers[category].push(answer)
            this.time.push(Date.now())
        }
    }
    
    decrypt(cipherText: string): void {
        const reb64 = CryptoJS.enc.Hex.parse(cipherText);
        const bytes = reb64.toString(CryptoJS.enc.Base64);
        const decrypt = CryptoJS.AES.decrypt(bytes, notSoSecretKey);
        const plain = decrypt.toString(CryptoJS.enc.Utf8);
        const parsed_result = JSON.parse(plain) as ResultForBlockchain;
        
        this.time     = [parsed_result.time];
        const full_result = {
            curiosity:   parsed_result.cur,
            honor:       parsed_result.hon,
            acceptance:  parsed_result.acc,
            mastery:     parsed_result.mas,
            leadership:  parsed_result.lea,
            freedom:     parsed_result.fre,
            relatedness: parsed_result.rel,
            order:       parsed_result.ord,
            goal:        parsed_result.goa,
            status:      parsed_result.sta,
            comfort:     parsed_result.com
        } as Result;
        this.result = full_result
    }

    calculateResults()
    {
        let scores: { [category: string]: number } = {};
 
        Object.keys(this.answers).forEach(category => {
            const categoryAnswers = this.answers[category];
            const average = categoryAnswers.reduce((acc: any, curr: any) => acc + curr, 0) / categoryAnswers.length;
            scores[category] = Number((Math.round(average * 100) / 100).toFixed(2));
        });
        const categoriesSortedByResult = Object.keys(scores).sort(function(a,b){return scores[b]-scores[a]})
        let percent_scores: { [category: string]: number } = {};
        categoriesSortedByResult.forEach((category) => {
            percent_scores[category] = Number((Math.round(100 * scores[category]) / numberOfAnswerChoises).toFixed(0));
        });
        this.result = percent_scores as Result;
    }
    
    encrypt() {
        this.calculateResults();
        const blockchain_result = {
            time: this.time[this.time.length-1],
            cur: this.result.curiosity,
            hon: this.result.honor,
            acc: this.result.acceptance,
            mas: this.result.mastery,
            lea: this.result.leadership,
            fre: this.result.freedom,
            rel: this.result.relatedness,
            ord: this.result.order,
            goa: this.result.goal,
            sta: this.result.status,
            com: this.result.comfort
        } as ResultForBlockchain;

        const stringifyedOnject = JSON.stringify(blockchain_result);
        var b64 = CryptoJS.AES.encrypt(stringifyedOnject, notSoSecretKey).toString();
        var e64 = CryptoJS.enc.Base64.parse(b64);
        var eHex = e64.toString(CryptoJS.enc.Hex);
        return eHex;
    }

    sortedCategories(): string[] {
        if (this.result) {
            return Object.keys(this.result).sort((a,b) =>{return this.result[b]-this.result[a]});
        } else {
            return [];
        }
    }

    isValid(): boolean {
        return this.result.curiosity !== undefined && this.result.honor !== undefined && this.result.acceptance !== undefined && this.result.mastery !== undefined && this.result.leadership !== undefined && this.result.freedom !== undefined && this.result.relatedness !== undefined && this.result.order !== undefined && this.result.goal !== undefined && this.result.status !== undefined && this.result.comfort !== undefined;
    }

    result7Score(category: string): number{
        if (this.result) {
            const percent = this.result[category]
            return Math.round(8 - (percent / 14.28));
        } else {
            return -1
        }
    }
}