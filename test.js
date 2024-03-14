const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('');

var otp='';

for(let i=0; i<6; i++){
  const randomInt= Math.ceil(Math.random()*9);
  otp+=randomInt;
}

const msg = {
  to: 'oprajesh330@gmail.com',
  from: 'tejaspawar62689@gmail.com',
  subject: 'Emotion Analytics',
  text: `${otp}`,
  html: `<p>Your OTP for resetting the Password for Emotion Analytics: <br> <b>${otp}</b></p>`,
};

sgMail.send(msg)
  .then(() => console.log('Email sent'))
  .catch(error => console.error(error));
