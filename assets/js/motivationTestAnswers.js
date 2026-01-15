const notSoSecretKey = 'dont give up, keep trying, try it from the other side.';
const numberOfAnswerChoises = 7;
class Answers {
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
    constructor() {
        this.time = 0;
        this.aut = 0;
        this.com = 0;
        this.rel = 0;
        this.div = 0;
        this.sig = 0;
        this.fee = 0;
        this.tas = 0;
        this.goa = 0;
    }
}
class Result {
    constructor() {
        this.time = 0;
        this.autonomy = 0;
        this.competence = 0;
        this.relatedness = 0;
        this.diversity_of_skills = 0;
        this.significance_of_the_task = 0;
        this.feedback = 0;
        this.task_identification = 0;
        this.goals_and_objectives = 0;
    }
}
export class motivationTestAnswers {
    constructor() {
        this.time = [];
        this.answers = new Answers;
        this.result = new Result;
    }
    addAnswer(category, answer) {
        if (category) {
            this.answers[category].push(answer);
            this.time.push(Date.now());
        }
    }
    decrypt(cipherText) {
        const reb64 = CryptoJS.enc.Hex.parse(cipherText);
        const bytes = reb64.toString(CryptoJS.enc.Base64);
        const decrypt = CryptoJS.AES.decrypt(bytes, notSoSecretKey);
        const plain = decrypt.toString(CryptoJS.enc.Utf8);
        const parsed_result = JSON.parse(plain);
        this.time = [parsed_result.time];
        const full_result = {
            autonomy: parsed_result.aut,
            competence: parsed_result.com,
            relatedness: parsed_result.rel,
            diversity_of_skills: parsed_result.div,
            significance_of_the_task: parsed_result.sig,
            feedback: parsed_result.fee,
            task_identification: parsed_result.tas,
            goals_and_objectives: parsed_result.goa
        };
        this.result = full_result;
    }
    calculateResults() {
        let scores = {};
        Object.keys(this.answers).forEach(category => {
            const categoryAnswers = this.answers[category];
            const average = categoryAnswers.reduce((acc, curr) => acc + curr, 0) / categoryAnswers.length;
            scores[category] = Number((Math.round(average * 100) / 100).toFixed(2));
        });
        const categoriesSortedByResult = Object.keys(scores).sort(function (a, b) { return scores[b] - scores[a]; });
        let percent_scores = {};
        categoriesSortedByResult.forEach((category) => {
            percent_scores[category] = Number((Math.round(100 * scores[category]) / numberOfAnswerChoises).toFixed(0));
        });
        this.result = percent_scores;
    }
    encrypt() {
        this.calculateResults();
        const blockchain_result = {
            time: this.time[this.time.length - 1],
            aut: this.result.autonomy,
            com: this.result.competence,
            rel: this.result.relatedness,
            div: this.result.diversity_of_skills,
            sig: this.result.significance_of_the_task,
            fee: this.result.feedback,
            tas: this.result.task_identification,
            goa: this.result.goals_and_objectives
        };
        const stringifyedOnject = JSON.stringify(blockchain_result);
        var b64 = CryptoJS.AES.encrypt(stringifyedOnject, notSoSecretKey).toString();
        var e64 = CryptoJS.enc.Base64.parse(b64);
        var eHex = e64.toString(CryptoJS.enc.Hex);
        return eHex;
    }
    sortedCategories() {
        if (this.result) {
            return Object.keys(this.result).sort((a, b) => { return this.result[b] - this.result[a]; });
        }
        else {
            return [];
        }
    }
    isValid() {
        return this.result.curiosity !== undefined && this.result.honor !== undefined && this.result.acceptance !== undefined && this.result.mastery !== undefined && this.result.leadership !== undefined && this.result.freedom !== undefined && this.result.relatedness !== undefined && this.result.order !== undefined && this.result.goal !== undefined && this.result.status !== undefined && this.result.comfort !== undefined;
    }
    result7Score(category) {
        if (this.result) {
            const percent = this.result[category];
            return Math.round(8 - (percent / 14.28));
        }
        else {
            return -1;
        }
    }
}
