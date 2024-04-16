const mongoose= require('mongoose');
const Schema= mongoose.Schema;
const passportLocalMongoose= require('passport-local-mongoose');
const Emotion= require('./emotionschema.js');

const ImageSchema= new Schema({
    url: String,
    filename: String,
});

ImageSchema.virtual('thumbnail').get(function (){
    return this.url.replace('/upload', '/upload/w_270,h_270');
});
const opts= {toJSON: {virtuals: true}};

const userschema= new Schema({
    fullname: {
        type: String,
        required: true,
    },
    semester:{
        type: String,
    },
    personalemail:String,
    gsuite: String,
    mobilenumber: String,
    image:[ImageSchema],
    verified: {
        type: Boolean,
        default: false,
    },
    active:{
        type: Boolean,
        default: true,
    },
    emotion: {
        type: Number,
        default: 0,
    },
    remark:{
        type: String,
        default: "!ok"
    }
}, opts);

userschema.plugin(passportLocalMongoose);

module.exports=mongoose.model('User',userschema);