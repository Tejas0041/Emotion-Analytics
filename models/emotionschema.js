const mongoose= require('mongoose');
const Schema= mongoose.Schema;

const emotionschema= new Schema({
    happy: Number,
    neutral: Number,
    sad: Number,
    angry: Number,
    fear: Number,
    disgusting: Number,
    surprise: Number
});

module.exports= mongoose.model('Emotion', emotionschema);