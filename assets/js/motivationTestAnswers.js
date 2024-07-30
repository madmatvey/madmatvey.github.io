const notSoSecretKey = 'dont give up, keep trying, try it from the other side.';
const numberOfAnswerChoises = 7;
class Answers {
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
    constructor() {
        this.time = 0;
        this.cur = 0;
        this.hon = 0;
        this.acc = 0;
        this.mas = 0;
        this.lea = 0;
        this.fre = 0;
        this.rel = 0;
        this.ord = 0;
        this.goa = 0;
        this.sta = 0;
        this.com = 0;
    }
}
class Result {
    constructor() {
        this.time = 0;
        this.curiosity = 0;
        this.honor = 0;
        this.acceptance = 0;
        this.mastery = 0;
        this.leadership = 0;
        this.freedom = 0;
        this.relatedness = 0;
        this.order = 0;
        this.goal = 0;
        this.status = 0;
        this.comfort = 0;
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
            curiosity: parsed_result.cur,
            honor: parsed_result.hon,
            acceptance: parsed_result.acc,
            mastery: parsed_result.mas,
            leadership: parsed_result.lea,
            freedom: parsed_result.fre,
            relatedness: parsed_result.rel,
            order: parsed_result.ord,
            goal: parsed_result.goa,
            status: parsed_result.sta,
            comfort: parsed_result.com
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
