import { Question } from './question.js'
import { motivationTestAnswers } from './motivationTestAnswers.js'

class Questions {
    autonomy: Question[];
    competence: Question[];
    relatedness: Question[];
    diversity_of_skills: Question[];
    significance_of_the_task: Question[];
    feedback: Question[];
    task_identification: Question[];
    goals_and_objectives: Question[];
    [key: string]: string | Question[];
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

class MotivationTest {
    questions: Questions;
    currentCategoryIndex: number;
    currentQuestionIndex: number;
    overallQuestionsIndex: number;
    answers: motivationTestAnswers;
    categories: string[];
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
        motivationTest.categories = Object.keys(motivationTest.questions)

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
            this.answers.addAnswer(this.currentCategory(), answer);
            
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
