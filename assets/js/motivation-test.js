"use strict";
// document.addEventListener('DOMContentLoaded', () => {
//     const parameters = [
//         'Curiosity', 'Honor', 'Acceptance', 'Mastery', 'Power',
//         'Freedom', 'Relatedness', 'Order', 'Goal', 'Status'
//     ];
let currentQuestionIndex = 0;
let answers = [];
document.addEventListener('DOMContentLoaded', () => {
    const questionElement = document.getElementById('question');
    const slider = document.getElementById('slider');
    const nextBtn = document.getElementById('nextBtn');
    fetch('/assets/js/data/motivation-test.json')
        .then(response => response.json())
        .then(data => {
        console.log("data: ", data);
        const questions = data[0].curiosity; // Измените на нужное поле из JSON
        showQuestion(questions[currentQuestionIndex]);
        nextBtn.addEventListener('click', () => {
            answers.push(parseInt(slider.value));
            currentQuestionIndex++;
            if (currentQuestionIndex < questions.length) {
                showQuestion(questions[currentQuestionIndex]);
            }
            else {
                showResult();
            }
        });
    });
    function showQuestion(question) {
        questionElement.textContent = question.question;
        slider.min = "1";
        slider.max = "10";
        slider.value = "1";
    }
    function showResult() {
        const resultDiv = document.getElementById('result');
        const average = answers.reduce((acc, curr) => acc + curr, 0) / answers.length;
        resultDiv.innerHTML = `
            <h2>Results:</h2>
            <p>Average score: ${average.toFixed(2)}</p>
        `;
        localStorage.setItem('motivationTestResult', JSON.stringify(answers));
    }
});
