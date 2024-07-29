import { motivationTestAnswers } from './motivationTestAnswers.js';
class Questions {
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
class MotivationTest {
    constructor() {
        this.questions = new Questions;
        this.answers = new motivationTestAnswers;
        this.categories = [];
        this.currentCategoryIndex = 0;
        this.currentQuestionIndex = 0;
        this.overallQuestionsIndex = 0;
    }
    async createAsync(language = 'en') {
        const motivationTest = new MotivationTest();
        motivationTest.questions = await fetchTestData(language);
        motivationTest.categories = Object.keys(motivationTest.questions);
        return motivationTest;
    }
    totalQuestions() {
        if (this.questions) {
            return Object.values(this.questions).reduce((sum, questions) => sum + questions.length, 0);
        }
        else {
            return 0;
        }
    }
    currentCategory() {
        if (this.questions) {
            return String(this.categories[this.currentCategoryIndex]);
        }
        else {
            return "";
        }
    }
    addAnswer(answer) {
        if (this.questions) {
            this.answers.addAnswer(this.currentCategory(), answer);
            if (this.currentQuestionIndex < (this.questions[this.currentCategory()]).length - 1) {
                this.currentQuestionIndex++;
            }
            else {
                this.currentQuestionIndex = 0;
                this.currentCategoryIndex++;
            }
            this.overallQuestionsIndex++;
        }
    }
    currentQuestion() {
        if (this.questions) {
            return this.questions[this.currentCategory()][this.currentQuestionIndex];
        }
        else {
            return undefined;
        }
    }
}
export default MotivationTest;
async function fetchTestData(language) {
    const dataUrl = `/assets/js/data/motivation-test/motivation-test-questions-${language}.json`;
    return fetch(dataUrl)
        .then(response => response.json())
        .then(data => {
        let result = data[0];
        return result;
    });
}
