var express = require('express');
var multer = require('multer');
var fs = require('fs');
var { GoogleGenerativeAI } = require('@google/generative-ai');
var router = express.Router();
const { PDFParse } = require('pdf-parse');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure multer for file uploads
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});

var upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Accept only PDF, DOC, DOCX, TXT files
        if (file.mimetype === 'application/pdf' ||
            file.mimetype === 'application/msword' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.mimetype === 'text/plain') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed'));
        }
    }
});

/* POST upload document and generate quiz */
router.post('/generate', upload.single('document'), async function(req, res, next) {
    if (!req.file) {
        return res.status(400).json({ error: 'No document uploaded' });
    }

    try {
        const quiz = await generateRealQuiz(req.file.path, req.file.originalname);
        res.json({
            success: true,
            filename: req.file.originalname,
            quiz: quiz
        });
    } catch (error) {
        console.error('Quiz generation error:', error);
        res.status(500).json({
            error: 'Failed to generate quiz',
            details: error.message
        });
    }
});

async function extractPdfText(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfDoc = await pdfjs.getDocument({ data: dataBuffer }).promise;

    let textContent = '';

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        textContent += pageText + ' ';
    }

    return textContent.trim();
}

async function generateRealQuiz(filePath, filename) {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Fixed model name

    let fileContent;

    // Check file type and read accordingly
    if (filename.toLowerCase().endsWith('.pdf')) {
        const parser = new PDFParse({ url: filePath });

        fileContent = (await parser.getText()).text;
        // console.log(fileContent);
    } else {
        // For TXT files
        fileContent = fs.readFileSync(filePath, 'utf8');
    }
    const prompt_generate_from_material = `
    Based on the following document content, generate a quiz with 5 multiple-choice questions.
    Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
    {
        "questions": [
            {
                "question": "Question text here",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct": 0
            }
        ]
    }

    Document content:
    ${fileContent}
    `;

    const prompt_generate_from_quiz = `
    You are a quiz formatter. Transform the following quiz content into a standardized JSON format.
    The input may contain questions in various formats (numbered, lettered, mixed formatting).
    
    Extract and format into this EXACT JSON structure (no markdown, no extra text):
    {
        "questions": [
            {
                "question": "Question text here (without question number)",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct": 0
            }
        ]
    }
    
    Rules:
    - Remove question numbers (1., 2., Q1, etc.)
    - Convert all answer choices to options array (A, B, C, D or 1, 2, 3, 4)
    - Set correct answer index (0 for A/1st, 1 for B/2nd, etc.)
    - If correct answer is marked or indicated, use that index
    - If no correct answer is marked, set correct: 0 as default
    - Clean up formatting and extra whitespace
    - Ensure exactly 4 options per question
    
    Quiz content to transform:
    ${fileContent}
    `;

    const result = await model.generateContent(prompt_generate_from_quiz);
    const response = await result.response;
    let text = response.text();

    // Preprocess: Remove markdown code blocks and clean up
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    try {
        const quizData = JSON.parse(text);
        return {
            id: Date.now(),
            title: `Quiz for ${filename}`,
            questions: quizData.questions,
            totalQuestions: quizData.questions.length
        };
    } catch (parseError) {
        console.error('Cleaned text:', text);
        throw new Error('Failed to parse AI response as JSON');
    }
}
module.exports = router;