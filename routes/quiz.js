var express = require('express');
var multer = require('multer');
var router = express.Router();

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
router.post('/generate', upload.single('document'), function(req, res, next) {
    if (!req.file) {
        return res.status(400).json({ error: 'No document uploaded' });
    }

    // Simulate processing delay
    setTimeout(() => {
        const pseudoQuiz = generatePseudoQuiz(req.file.originalname);
        res.json({
            success: true,
            filename: req.file.originalname,
            quiz: pseudoQuiz
        });
    }, 2000);
});

function generatePseudoQuiz(filename) {
    // Pseudo quiz generation based on filename/content type
    const quizzes = [
        {
            question: "What is the main topic discussed in the uploaded document?",
            options: ["Topic A", "Topic B", "Topic C", "Topic D"],
            correct: 0
        },
        {
            question: "Which concept is emphasized throughout the material?",
            options: ["Concept 1", "Concept 2", "Concept 3", "Concept 4"],
            correct: 1
        },
        {
            question: "What is the key takeaway from this study material?",
            options: ["Learning outcome A", "Learning outcome B", "Learning outcome C", "Learning outcome D"],
            correct: 2
        }
    ];

    return {
        id: Date.now(),
        title: `Quiz for ${filename}`,
        questions: quizzes,
        totalQuestions: quizzes.length
    };
}

module.exports = router;