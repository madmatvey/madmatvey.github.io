const notSoSecretKey = 'dont give up, keep trying, try it from the other side.';
const numberOfAnswerChoises: number = 7;

class Answers {
    autonomy:                 number[];
    competence:               number[];
    relatedness:              number[];
    diversity_of_skills:      number[];
    significance_of_the_task: number[];
    feedback:                 number[];
    task_identification:      number[];
    goals_and_objectives:     number[];
    [key: string]: number[];
    constructor() {
        this.autonomy = [];
        this.competence = [];
        this.relatedness = [];
        this.diversity_of_skills = [];
        this.significance_of_the_task = [];
        this.feedback = [];
        this.task_identification = [];
        this.goals_and_objectives = [];
    }
}

class ResultForBlockchain {
    time: number = 0;
    aut: number = 0;
    com: number = 0;
    rel: number = 0;
    div: number = 0;
    sig: number = 0;
    fee: number = 0;
    tas: number = 0;
    goa: number = 0;
}

class Result {
    time:                     number = 0;
    autonomy:                 number = 0;
    competence:               number = 0;
    relatedness:              number = 0;
    diversity_of_skills:      number = 0;
    significance_of_the_task: number = 0;
    feedback:                 number = 0;
    task_identification:      number = 0;
    goals_and_objectives:     number = 0;
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
            autonomy:                 parsed_result.aut,
            competence:               parsed_result.com,
            relatedness:              parsed_result.rel,
            diversity_of_skills:      parsed_result.div,
            significance_of_the_task: parsed_result.sig,
            feedback:                 parsed_result.fee,
            task_identification:      parsed_result.tas,
            goals_and_objectives:     parsed_result.goa
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
            aut:  this.result.autonomy,
            com:  this.result.competence,
            rel:  this.result.relatedness,
            div:  this.result.diversity_of_skills,
            sig:  this.result.significance_of_the_task,
            fee:  this.result.feedback,
            tas:  this.result.task_identification,
            goa:  this.result.goals_and_objectives
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