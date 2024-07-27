class MotivationTest {
    constructor() {
        this.questions = undefined;
        this.answers = {};
        this.categories = [];
        this.currentCategoryIndex = 0;
        this.currentQuestionIndex = 0;
        this.overallQuestionsIndex = 0;
    }
    async createAsync(language = 'en') {
        const motivationTest = new MotivationTest();
        motivationTest.questions = await fetchTestData(language);
        motivationTest.categories = Object.keys(motivationTest.questions);
        motivationTest.categories.forEach(category => motivationTest.answers[category] = []);
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
            this.answers[this.currentCategory()].push(answer);
            console.log("addAnswer.this.questions:", this.questions);
            console.log("addAnswer.this.currentCategory():", this.currentCategory());
            console.log("addAnswer.this.currentQuestionIndex:", this.currentQuestionIndex);
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
            console.log("currentQuestion.questions:", this.questions);
            console.log("currentQuestion.currentCategory():", this.currentCategory());
            console.log("currentQuestion.currentCategoryIndex:", this.currentCategoryIndex);
            console.log("currentQuestion.currentQuestionIndex:", this.currentQuestionIndex);
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
    console.log("dataUrl: ", dataUrl);
    return fetch(dataUrl)
        .then(response => response.json())
        .then(data => {
        let result = data[0];
        return result;
    });
}
