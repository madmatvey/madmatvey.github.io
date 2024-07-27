import { Question } from './question.js'

interface Questions {
    curiosity: Question[];
    honor: Question[];
    acceptance: Question[];
    mastery: Question[];
    power: Question[];
    freedom: Question[];
    relatedness: Question[];
    order: Question[];
    goal: Question[];
    status: Question[];
    [key: string]: string | Question[];
}

class MotivationTest {
    questions: Questions | undefined;
    currentCategoryIndex: number;
    currentQuestionIndex: number;
    overallQuestionsIndex: number;
    answers: { [category: string]: number[]  };
    categories: string[];
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
        motivationTest.categories = Object.keys(motivationTest.questions)
        motivationTest.categories.forEach(category => motivationTest.answers[category] = []);
        return motivationTest;
    }
    totalQuestions() {
        if(this.questions) {
            return Object.values(this.questions).reduce((sum, questions) => sum + questions.length, 0);
        } else {
            return 0;
        }
    }
    currentCategory(): string {
        if(this.questions) {
            return String(this.categories[this.currentCategoryIndex])
        } else {
            return "";
        }
    }
    addAnswer(answer: number) {
        if(this.questions) {
            this.answers[this.currentCategory()].push(answer);
            
            if (this.currentQuestionIndex < (this.questions[this.currentCategory()]).length - 1) {
                this.currentQuestionIndex++;
            } else {
                this.currentQuestionIndex = 0;
                this.currentCategoryIndex++;
            }
            this.overallQuestionsIndex++;
        }
    }
    currentQuestion(): Question | undefined {
        if(this.questions) {
            return this.questions[this.currentCategory()][this.currentQuestionIndex] as Question;
        } else {
            return undefined;
        }
    }
}

export default MotivationTest

async function fetchTestData(language: string): Promise<Questions> {
    const dataUrl = `/assets/js/data/motivation-test/motivation-test-questions-${language}.json`
    
    return fetch(dataUrl)
        .then(response => response.json())
        .then(data => {
            let result: Questions = data[0];
            return result;
        });
    }
