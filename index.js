if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config();
}

const express= require('express');
const app= express();
const methodOverride= require('method-override');
const mongoose= require('mongoose');
const path= require('path');
const ejsMate= require('ejs-mate');
const session= require('express-session');
const flash= require('connect-flash');
const User= require('./models/userschema.js');
const Emotion= require('./models/emotionschema.js');
const {cloudinary}= require('./cloudinary/cloudinary.js');
const multer= require('multer');
const {storage} = require('./cloudinary/cloudinary.js');
const upload= multer({storage});
const passport= require('passport');
const LocalStrategy= require('passport-local');
const MongoDBStore= require("connect-mongo");
const cors = require('cors');
const sgMail = require('@sendgrid/mail');
const sgMailApi= process.env.SENDGRID_API;
var OTP=0;
const faceapi = require('face-api.js');
const modelsDirectory = path.join(__dirname, 'public', 'model');

const httpProxy = require('http-proxy');
const proxy = httpProxy.createProxyServer();

const secret= process.env.SECRET || 'thisshouldbeabettersecret';
// const dbUrl= 'mongodb://localhost:27017/emotion-analytics';
const dbUrl= process.env.DB_URL;


const {isLoggedIn, isAdmin, isVerified, isActive}= require('./middleware.js');

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: true}));

app.use(methodOverride('_method'));

app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

sgMail.setApiKey(sgMailApi);

mongoose.connect(dbUrl);

const db= mongoose.connection;
db.on("error", console.error.bind(console, "connection error: "));
db.once("open", ()=>{
    console.log("Database Connected");
});

const store = new MongoDBStore({
    mongoUrl: dbUrl,
    secret,
    touchAfter: 24*60*60 //time is in seconds
});

store.on('error', function(err){
    console.log("Error!", err);
})

const sessionConfig= {
    store,
    name: 'emotionanalytics',
    httpOnly: true,
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + (1000*60*60*24*7),
        maxAge: (1000*60*60*24*7)
    }
}

app.use(session(sessionConfig));
app.use(flash());


app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

passport.use(new LocalStrategy(User.authenticate()));
var k=0;

app.use('/face-api', (req, res) => {
    proxy.web(req, res, { target: 'http://face-api-server.com' });
});

app.use((req, res, next)=>{
    res.locals.currentUser= req.user;
    res.locals.success= req.flash('success');
    res.locals.error= req.flash('error');
    res.locals.dot= k;
    next();
});


app.get('/', (req, res)=>{
    if(req.user) res.redirect('/viewprofile');
    else res.redirect('/login');
});

app.get('/home', isLoggedIn, isVerified, isActive, async(req, res)=>{
    res.render('templates/home.ejs');
});

app.get('/homeadmin/:filter', async(req, res)=>{
    const {filter}= req.params;

    if(filter=='all'){
        var users= await User.find({verified: true});
    }else if(filter=='active'){
        var users= await User.find({active: true});
    }else if(filter=='deactive'){
        var users= await User.find({active: false});
    }

    res.render('templates/homeadmin.ejs', {users});
});

app.get('/viewprofile/:id', isLoggedIn, isVerified, isActive, async(req, res)=>{
    // const u= req.user;
    const {id}= req.params;
    const u= await User.findById(id);
    res.render('templates/profile.ejs', {u});
});

app.get('/viewprofile', isLoggedIn, isVerified, isActive, async(req, res)=>{
    const u= req.user;
    // const {id}= req.params;
    // const u= await User.findById(id);
    res.render('templates/profile.ejs', {u});
});

app.get('/login', (req, res)=>{
    res.render('templates/login.ejs');
});

app.get('/login/admin', (req, res)=>{
    res.render('templates/adminlogin.ejs');
});

app.post('/login', isVerified, isActive, passport.authenticate('local', {failureFlash: true, failureRedirect: '/login'}), (req, res)=>{
    req.flash('success', "Welcome back!");

    res.redirect('/viewprofile');
});

app.post('/login/admin', isAdmin, passport.authenticate('local', {failureFlash: true, failureRedirect: '/login/admin'}), (req, res)=>{
    req.flash('success', "Welcome back, Admin!");

    res.redirect('/homeadmin/all');
});

app.get('/logout', (req, res)=>{
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        req.flash('success', "Logged you out!");
        res.redirect('/login');
    });
});

//for admin
app.get('/approval-request',isAdmin, async(req, res)=>{
    const users= await User.find({verified: false, remark: "!ok"});
    if(users){
        notification=1;
    }else notification =0;

    res.render('templates/approvalrequest.ejs', {users, notification});
});

app.get('/approval/:id', async(req, res)=>{
    const {id}= req.params;
    const u= await User.findById(id);
    if((u.verified===true)&&(u.active===true)) return res.redirect('/home');

    if(!u.active){
        var message='Your account has been currently Deactivated by the Admin';
    }
    if((u.verified===false)&&(u.remark==="!ok")){
        var message= 'Please wait until the Admin verify your details';
    }
    if((u.verified===false)&&((u.remark!="!ok")&&(u.remark!="ok"))){
        return res.render('templates/resubmission.ejs', {u});
    }

    res.render('templates/approvalmessage.ejs', {message});
});

app.post('/approve-registration/:id', isAdmin, async(req, res)=>{
    const id= req.params.id;

    const user= await User.findById(id);

    user.verified=true;
    user.remark= 'ok';
    k-=1;
    await user.save();
    res.redirect('/approval-request');
});

app.post('/decline-registration/:id', isAdmin, async(req, res)=>{
    const {id}= req.params;
    const user= await User.findById(id);
    const {remark}= req.body;
    user.remark= remark;
    user.save();
    // const user= await User.findByIdAndDelete(id);
    k-=1;
    res.redirect('/approval-request');
});

app.get('/register', (req, res)=>{
    res.render('templates/register.ejs');
});

app.post('/register',upload.array('image'), async(req, res)=>{
    try{
        const data= req.body;


        const {fullname, username, personalemail, gsuite, semester, mobilenumber, password}= req.body;

        var u_personalemail= 0;
        var u_gsuite= 0;
        var u_mobilenumber= 0;
        u_personalemail= await User.find({personalemail});
        u_gsuite= await User.find({gsuite});
        u_mobilenumber= await User.find({mobilenumber});

        if(u_personalemail!=0){
            req.flash('error',`An account with personal email ${personalemail} already exist`);
            return res.redirect('/register');
        }

        if(u_gsuite!=0){
            req.flash('error',`An account with Gsuite ID ${gsuite} already exist`);
            return res.redirect('/register');
        }

        if(u_mobilenumber!=0){
            req.flash('error',`An account with Mobile number ${mobilenumber} already exist`);
            return res.redirect('/register');
        }

        const u = new User({fullname, username, personalemail, gsuite, semester, mobilenumber});

        u.image =req.files.map(f=>({url:f.path, filename: f.filename}));
        u.emotion= 0;
        const newUser= await User.register(u, password);
        k+=1;
        res.redirect(`/approval/${newUser._id}`);
    }

    catch(e){
        req.flash('error', e.message);
        res.redirect('/register');
    }
});

app.get('/profile/edit/:id', isLoggedIn, isVerified, isActive, async(req, res)=>{
    const {id}= req.params;
    const u= await User.findById(id);

    res.render('templates/editprofile.ejs', {u});
});

app.put('/profile/edit/:id',isLoggedIn, isVerified, isActive, upload.array('image'), async(req, res)=>{
    const {id}= req.params;
    const u= req.body;
    const user= await User.findById(id);
    user.fullname= u.fullname;
    user.semester= u.semester;
    user.personalemail= u.personalemail;
    user.mobilenumer= u.mobilenumber;
    const pic= user.image;

    // const user= await User.findByIdAndUpdate(id, {u});

    if(req.files){
        const img= req.files.map(f=>({url: f.path, filename: f.filename}));
        user.image= img;
    }

    if(req.files.length===0){
        user.image=pic;
    }

    await user.save();

    req.flash('success', 'Successfully updated your profile');
    res.redirect('/viewprofile');
});

app.post('/stats', isLoggedIn, isVerified, isActive, async(req, res)=>{
    const emotion= req.body;
    const newEmo= new Emotion(req.body);

    newEmo.user= req.user._id;

    const u= await User.findById(newEmo.user);
    u.emotion++;

    u.save();

    const id= newEmo.user;

    await newEmo.save();
    res.render('templates/stats.ejs', {emotion, id});
});

app.get('/bargraph/:id', async(req, res)=>{
    const {id}= req.params;
    const U= await User.findById(id);
    const e= await Emotion.find({user: id});
    var actualEmo= e[U.emotion-1];

    const jsonData = JSON.stringify({
        labels: ['happy', 'neutral', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'],
        values: [actualEmo.happy/1000, actualEmo.neutral/1000, actualEmo.sad/1000, actualEmo.angry/1000, actualEmo.fearful/1000, actualEmo.disgusted/1000, actualEmo.surprised/1000] // Example values
    });



    // const data = JSON.stringify(dta);

    // return res.send(data);
    res.render('templates/bargraph.ejs', {jsonData});
})

app.get('/piechart/:id', async(req, res)=>{
    const {id}= req.params;
    const U= await User.findById(id);
    const e= await Emotion.find({user: id});
    var actualEmo= e[U.emotion-1];

    const pieJsonData = JSON.stringify({
        labels: ['happy', 'neutral', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'],
        values: [actualEmo.happy/1000, actualEmo.neutral/1000, actualEmo.sad/1000, actualEmo.angry/1000, actualEmo.fearful/1000, actualEmo.disgusted/1000, actualEmo.surprised/1000] // Example values
    });
    res.render('templates/piechart.ejs', {pieJsonData});
})

app.get('/deactivate/:id', isAdmin, async(req, res)=>{
    const {id}= req.params;
    const u= await User.findById(id);

    u.active=false;
    u.save();

    res.redirect('/homeadmin/all');
});

app.get('/activate/:id', isAdmin, async(req, res)=>{
    const {id}= req.params;
    const u= await User.findById(id);

    u.active=true;
    u.save();

    res.redirect('/homeadmin/all');
});

app.get('/declined-request', isAdmin, async(req, res)=>{
    const users= await User.find({verified: false, remark: {$ne: "!ok"}});
    res.render('templates/declinedrequest.ejs', {users});
});

app.get('/forgot-password', (req, res)=>{
    res.render('templates/forgotpassword.ejs');
});

app.post('/otp-verification-page', async(req, res)=>{
    const enrollment= req.body.enrollment;
    var u=0;

    u= await User.find({username: enrollment});
    if(Object.entries(u).length===0){
        req.flash('error', `No account with the Enrollment number "${enrollment}"`);
        return res.redirect('/forgot-password');
    }

    var otp='';

    for(let i=0; i<6; i++){
      const randomInt= Math.ceil(Math.random()*9);
      otp+=randomInt;
    }

    OTP=otp;

    const msg = {
     to: `${u[0].gsuite}`,
     from: 'tejaspawar62689@gmail.com',
     subject: 'Emotion Analytics',
     text: `OTP: ${otp}`,
     html: `<p>Your OTP for resetting the Password for Emotion Analytics: <br> <b>${otp}</b></p> <hr> <img src="https://res.cloudinary.com/dxo8tirbk/image/upload/v1709249909/EmotionAnalytics/logo_wj2ma2.png" alt="can't load the image at the moment">
     <div>&copy; 2024 Emotion Analytics. All rights reserved</div>`,
    };

    sgMail.send(msg)
     .then(() => console.log('Email sent'))
     .catch(error => console.error(error));


    res.render('templates/otpverification.ejs', {u});
});

app.post('/change-password/:id', async(req, res)=>{
    const {id}= req.params;
    const u= await User.findById(id);

    const r= req.body;
    var response_otp= r.x1+r.x2+r.x3+r.x4+r.x5+r.x6;
    if(OTP==response_otp){
        res.render('templates/changepassword.ejs', {u});
    }
    else{
        req.flash('error', "Incorrect OTP");
        res.redirect('/forgot-password');
    }

});

app.post('/update-password/:id', async(req, res, next)=>{
    const {id}= req.params;

    const user = await User.findById(id).select('+hash');

    const data= 'fake';

    const temp= new User({fullname: data, username: data, personalemail: data, gsuite: data, semester: data, mobilenumber: data, password: req.body.password_cp});
    const newUser= await User.register(temp, req.body.password_cp);

    const newHashedPass= newUser.hash;
    const newSalt= newUser.salt;

    await User.findOneAndDelete({username: data});

    try{
        user.hash= newHashedPass;
        user.salt= newSalt;
        user.save();
        req.flash('success', "Successfully changed the password. Now Login with new Password")
        res.redirect('/login');
    }catch(e){
        console.log(e);
    }
});

app.post('/resubmission/:id',upload.array('image'), async(req, res)=>{
    const {id}= req.params;
    const u= req.body;
    const user= await User.findById(id);
    user.fullname= u.fullname;
    user.username= u.username;
    user.semester= u.semester;
    user.personalemail= u.personalemail;
    user.mobilenumer= u.mobilenumber;
    user.remark= "!ok";
    const pic= user.image;


    if(req.files){
        const img= req.files.map(f=>({url: f.path, filename: f.filename}));
        user.image= img;
    }

    if(req.files.length===0){
        user.image=pic;
    }

    await user.save();
    k+=1;

    req.flash('success', 'Successfully updated your registered data');
    res.redirect(`/approval/${id}`);
});

app.listen(8080, ()=>{
    console.log('app started successfully at port 8080');
});