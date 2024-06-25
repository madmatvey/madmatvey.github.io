// document.addEventListener('DOMContentLoaded', () => {
//     const parameters = [
//         'Curiosity', 'Honor', 'Acceptance', 'Mastery', 'Power',
//         'Freedom', 'Relatedness', 'Order', 'Goal', 'Status'
//     ];

//     const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
//     const radarChart = document.getElementById('radarChart') as HTMLCanvasElement;
//     const ctx = radarChart.getContext('2d');

//     submitBtn.addEventListener('click', () => {
//         const values = parameters.map(param => {
//             const input = document.getElementById(param.toLowerCase()) as HTMLInputElement;
//             return parseInt(input.value);
//         });

//         drawRadarChart(values);
//     });

//     function drawRadarChart(values: number[]) {
//         const data = {
//             labels: parameters,
//             datasets: [{
//                 label: 'Motivation Level',
//                 data: values,
//                 backgroundColor: 'rgba(255, 99, 132, 0.2)',
//                 borderColor: 'rgba(255, 99, 132, 1)',
//                 borderWidth: 1
//             }]
//         };

//         const options = {
//             scale: {
//                 ticks: { beginAtZero: true, max: 10 },
//                 pointLabels: { fontSize: 14 }
//             }
//         };

//         if (ctx != null) {
//             new Chart(ctx, {
//                 type: 'radar',
//                 data: data,
//                 options: options
//             });
//         }
        
//     }
// });


interface Question {
    question: string;
    low: string;
    high: string;
}

let currentQuestionIndex = 0;
let answers: number[] = [];

document.addEventListener('DOMContentLoaded', () => {
    const questionElement = document.getElementById('question') as HTMLParagraphElement;
    const slider = document.getElementById('slider') as HTMLInputElement;
    const nextBtn = document.getElementById('nextBtn') as HTMLButtonElement;

    fetch('/assets/js/data/motivation-test.json')
        .then(response => response.json())
        .then(data => {
            console.log("data: ", data);
            const questions: Question[] = data[0].curiosity; // Измените на нужное поле из JSON

            showQuestion(questions[currentQuestionIndex]);

            nextBtn.addEventListener('click', () => {
                answers.push(parseInt(slider.value));
                currentQuestionIndex++;

                if (currentQuestionIndex < questions.length) {
                    showQuestion(questions[currentQuestionIndex]);
                } else {
                    showResult();
                }
            });
        });

    function showQuestion(question: Question) {
        questionElement.textContent = question.question;
        slider.min = "1";
        slider.max = "10";
        slider.value = "1";
    }

    function showResult() {
        const resultDiv = document.getElementById('result') as HTMLDivElement;
        const average = answers.reduce((acc, curr) => acc + curr, 0) / answers.length;

        resultDiv.innerHTML = `
            <h2>Results:</h2>
            <p>Average score: ${average.toFixed(2)}</p>
        `;

        localStorage.setItem('motivationTestResult', JSON.stringify(answers));
    }
});
