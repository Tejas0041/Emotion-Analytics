const mongoose= require('mongoose');
const Schema= mongoose.Schema;

const emotionschema= new Schema({
    happy: Number,
    neutral: Number,
    sad: Number,
    angry: Number,
    fearful: Number,
    disgusted: Number,
    surprised: Number,
    user: String,
});

module.exports= mongoose.model('Emotion', emotionschema);