const User= require('./models/userschema.js');

module.exports.isLoggedIn= (req, res, next)=>{
    if(!req.isAuthenticated())
      {
        req.flash('error', 'You must be logged In!');
        return res.redirect('/login');
      }
    next();
}

module.exports.isAdmin= async(req, res, next)=>{

  var username= req.body.username;
  if(req.user){
    username= req.user.username;
  }

  if(!(username=='Admin'))
  {
    console.log(username);
    req.flash('error', 'Incorrect Admin Id or password');
    return res.redirect(`/login`);
  }
  next();
}

module.exports.isVerified= async(req, res, next)=>{
  const {username}= req.body;
  const user= await User.findOne({username});

  if(user && (user.verified===false))
  {
    req.flash('error', "You are not Verified user");
    return res.redirect(`/approval/${user._id}`);
  }
  next();
}

module.exports.isActive= async(req, res, next)=>{
  var username= req.body.username;
  if(req.user){
    username= req.user.username;
  }
  const user= await User.findOne({username});

  if(user && (user.active===false))
  {
    req.flash('error', "You are currently Deactivated by the Admin");
    return res.redirect(`/approval/${user._id}`);
  }
  next();
}