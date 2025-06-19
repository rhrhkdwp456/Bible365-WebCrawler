const express = require('express');
const https = require('https')
const fs = require('fs');
const axios = require('axios'); // jquery의 Ajax같은놈
const cheerio = require('cheerio'); // python의 bs4같은놈
// mongodb 셋팅
const { MongoClient, ObjectId } = require('mongodb')

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});

axios.defaults.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// moment 샛팅
const moment = require('moment')

// 환경변수 따로 파일로 만들기.
// npm install dotenv 설치
require('dotenv').config()

const app = express();

// 폴더를 server.js에 등록해두면 폴더안의 파일들 html에서 사용 가능.
app.use(express.static(__dirname +'/public'))

// 요청.body 쓰러면 필수적으로 작성해야 됨.
app.use(express.json())
app.use(express.urlencoded({extended:true})) 

// passport 라이브러리 셋팅 시작
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')

// connect-mongo 라이브러리 셋팅
const MongoStore = require('connect-mongo') 
const e = require('express')

app.use(passport.initialize())
app.use(session({
  secret: process.env.SESSION_PW , // 세션의 document id는 암호화해서 유저에게 보냄
  resave : false, // 유저가 서버로 요청할 때마다 세션 갱신할건지(보통은 false함.)
  saveUninitialized : false, // 로그인 안해도 세션 만들것인지(보통 false)
  cookie : { maxAge : 60* 60 * 1000 } ,// 세션 document 유효기간 변경 하는 코드(60*1000 -> 60초, 60*60*1000 -> 1시간)
  store : MongoStore.create({
    mongoUrl : process.env.DB_URL,
    dbName : 'bible365'
  })
}))

app.use(passport.session()) 
// passport 라이브러리 셋팅 끝.

// MongoDB 연결하기 위해 하는 셋팅

const { render } = require('ejs')
let connectDB = require('./database.js')
let db;

connectDB.then((client)=>{
    console.log('DB연결성공')
    db = client.db('bible365')
}).catch((err)=>{
  console.log(err)
})

//bcrypt 라이브러리 셋팅(암호화)
const bcrypt = require('bcrypt'); 
const { count } = require('console');



//ejs 셋팅 하는 코드
// html 파일에 데이터를 넣고 싶으면 .ejs 파일로 만들어야 가능.
// ejs파일은 꼭 views라는 폴더를 만들어서 생성.
app.set('view engine', 'ejs')

// 폴더를 server.js에 등록해두면 폴더안의 파일들 html에서 사용 가능.
app.use(express.static(__dirname +'/public'))

// ejs 셋팅
app.set('view engine', 'ejs')

// 요청.body 쓰러면 필수적으로 작성해야 됨.
app.use(express.json())
app.use(express.urlencoded({extended:true})) 


// 세션 데이터를 DB에 저장하려면 connect-mongo 라이브러리 설치
// npm install bcrypt -> 해슁을 하기 위해서 사용하는 라이브러리 bcrypt 설치


// 필요한 라이브러리 npm install express-session passport passport-local 
// passport는 회원인증 도와주는 메인라이브러리,
// passport-local은 아이디/비번 방식 회원인증쓸 때 쓰는 라이브러리
// express-session은 세션 만드는거 도와주는 라이브러리입니다.


// 회원관련 기능 
// 제출한 아이디 비번이 DB에 있는지 검사하는 로직
// 있으면 세션만들어줌
// 이 밑에 있는 코드를 실행하고 싶으면 passport.authenticate('local')() 쓰면 됨.

passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
    let result = await db.collection('user').findOne({ userid : 입력한아이디})
    if (!result) {
      return cb(null, false, { message: '아이디 DB에 없음' })
    }

    if (await bcrypt.compare(입력한비번, result.password)) {
      return cb(null, result)
    } else {
      return cb(null, false, { message: '비번불일치' });
    }
  }))

// 밑에 내용은 요청.login() 실행할때마다 같이 실행됨.
// 세션 document에 들어갈 내용들을 보내줌.
passport.serializeUser((user, done) =>{
    process.nextTick(() => { // 내부 코드를 비동기적으로 처리해줌
        done(null, { id : user._id , userid: user.userid })
    })
})


// 밑에 내용은 마찬가지로 요청.login() 실행할때마다 같이 실행됨.
// 쿠키를 분석해주는 역할(입장권 확인 역할)
// 이 밑 코드가 있으면 아무대서나 요청.user 사용하면 로그인한 사용자의 정보를 보내줌. 
passport.deserializeUser(async (user, done) =>{
    let result = await db.collection('user').findOne({_id: new ObjectId(user.id)})
    delete result.password // 비번은 삭제
    process.nextTick(() => { // 내부 코드를 비동기적으로 처리해줌
        done(null, result) // result에 저장된 값이 요청.user에 들어감.
    })
})




app.listen(process.env.PORT, () => {
    console.log(`서버켜짐: http://localhost:${process.env.PORT}`);
});

app.get('/', (요청, 응답) => {
    응답.sendFile(__dirname + '/index.html')
});

// 이미지 파일 불러오기 위해서 url로 접근하는 코드
app.get('/bible', (요청, 응답)=>{
    fs.readFile('./public/image/bible.jpg', function(err, data){
        응답.writeHead(200);
        응답.write(data);
        응답.end();
    })
})
// app.get('/getdata/text', async(요청,응답)=>{
//     const url = "https://sum.su.or.kr:8888/bible/today"
//     const response = await axios.get(url, { httpsAgent });
//     const html = response.data;
//     const $ = cheerio.load(html);
//     var words_lesson_check = $('.g_text').eq(0).text().trim() // words_who가 있는지 확인
//     console.log(words_lesson_check)
// })
app.get('/getdata', async(요청,응답)=>{

    let today = moment().format('YYYY-MM-DD') // 오늘 날짜
    const url = "https://sum.su.or.kr:8888/bible/today"
    const response = await axios.get(url, { httpsAgent });
    const html = response.data;
    const $ = cheerio.load(html);

    // 제목
    var words_title = $('#bible_text').text().trim()
    // console.log(words_title)

    // 본문
    var words_main = $('#bibleinfo_box').text().trim()
    // console.log(words_main)
    
    // 본문 말씀
    let words_text = ''; // 말씀 저장할 리스트
    const words_count = $('.info').length
    let num = parseInt($('.num').eq(0).text().trim(), 10);
    $('.info').each((index, element) => {
        const text = $(element).text().trim(); // 요소의 텍스트 가져오기
        // console.log(`${index + 1}: ${text}`); // 인덱스와 텍스트 출력
        words_text += num+'. '+text+'\n'
        num +=1
      });
    // console.log(words_text) // words_text 리스트에 말씀 전부 넣어놈.

    // 경우의 수 나누기
    // words_who가 없는 경우
    // words_lesson이 없는 경우
    // 둘다 있는 경우

    // words_who랑 words_lesson값 가져오기.
    var words_check = $('.g_text').eq(0).text().trim() // 1번째 g_text값 가져오기.
    var words_check2 = $('.g_text').eq(1).text().trim() // 2번째 g_text값 가져오기.
    
    if(words_check=="예수님은 어떤 분입니까?" || words_check=="하나님은 어떤 분입니까?"){
        // words_check가 예수님은 어떤 분입니까? 혹은 하나님은 어떤 분입니까?
        if(words_check2 =="내게 주시는 교훈은 무엇입니까?"){
            //console.log("words_who랑 words_lesson 둘다 있는 경우")
            // words_who랑 words_lesson 둘다 있는 경우
            // 하나님은 어떤 분입니까?
            var words_who = $('.text').eq(2).text().trim()
            words_who = words_who.replace(/\./g,'.\n');
            words_who = words_who.replace(/  /g,'');
            // console.log(words_who)

            // 내게 주시는 교훈
            var words_lesson = $('.text').eq(3).text().trim()
            words_lesson = words_lesson.replace(/\./g,'.\n');
            words_lesson = words_lesson.replace(/  /g,'');
            // console.log(words_lesson)

            // 기도
            var words_pray = $('.text').eq(4).text().trim()
            words_pray = words_pray.replace(/\./g,'.\n');
            words_pray = words_pray.replace(/  /g,'');
            // console.log(words_pray)

            await db.collection('qt').insertOne({
                words_title : words_title,
                words_main : words_main,
                words_text : words_text,
                words_check: words_check,
                words_who : words_who,
                words_check2 : words_check2,
                words_lesson : words_lesson,
                words_pray : words_pray,
                date : today
            })
        }
        else{
            //console.log("words_who만 있는 경우")
            // words_who만 있는 경우
            // 하나님은 어떤 분입니까?
            var words_who = $('.text').eq(2).text().trim()
            words_who = words_who.replace(/\./g,'.\n');
            words_who = words_who.replace(/  /g,'');
            // console.log(words_who)

            
            // 기도
            var words_pray = $('.text').eq(3).text().trim()
            words_pray = words_pray.replace(/\./g,'.\n');
            words_pray = words_pray.replace(/  /g,'');
            // console.log(words_pray)

            await db.collection('qt').insertOne({
                words_title : words_title,
                words_main : words_main,
                words_text : words_text,
                words_check: words_check,
                words_who : words_who,
                words_check2 : '',
                words_lesson : '',
                words_pray : words_pray,
                date : today
            })
        }
    }
    else{
        // words_lesson만 있는 경우
        //console.log("words_lesson만 있는 경우")
        // 내게 주시는 교훈
        var words_lesson = $('.text').eq(2).text().trim()
        words_lesson = words_lesson.replace(/\./g,'.\n');
        words_lesson = words_lesson.replace(/  /g,'');
        // console.log(words_lesson)

        // 기도
        var words_pray = $('.text').eq(3).text().trim()
        words_pray = words_pray.replace(/\./g,'.\n');
        words_pray = words_pray.replace(/  /g,'');
        // console.log(words_pray)

        await db.collection('qt').insertOne({
            words_title : words_title,
            words_main : words_main,
            words_text : words_text,
            words_who : '',
            words_check: '',
            words_check2 : words_check,
            words_lesson : words_lesson,
            words_pray : words_pray,
            date : today
        })
    }
    
    응답.redirect('/home')
})

app.get('/home',checkLogin, async(요청,응답)=>{
    let mylist = await db.collection('contemplation').find({
        userid : 요청.user._id
    }).toArray()
    let this_month = moment().format('YYYY-MM')
    let result = await db.collection('qt').find({
        // date : /^2024-06/
        date : new RegExp(this_month)
    }).toArray()
    result = result.reverse()
    if(요청.user == undefined || 요청.user.authority=="normal"){
        응답.sendFile(__dirname+'/index.html')
    }
    else{
        if(요청.user && 요청.user.authority == "youth"){ // 권한이 청년부인 경우
            응답.render('words-list.ejs', { result : result , this_month : this_month, mylist: mylist})
        }
        else if(요청.user.authority == "MANAGER"){ // 권한이 매니저인 경우
            응답.render('words-list-manager.ejs', { result : result , this_month : this_month, mylist: mylist})
        }
        else{ // 권한 없는 경우(로그인페이지)
            응답.render('login.ejs')
        }
    }
})

app.get('/manager',checkLogin, async(요청, 응답) =>{
    if(요청.user.authority=="MANAGER"){
        let result = await db.collection('user').find().toArray()
        응답.render('manager.ejs', {result:result})
    }
    else{

        응답.redirect('/home')
    }
    
})

app.get('/rank', checkLogin, async(요청, 응답) =>{

    // let myqt = await db.collection('contemplation').find({
    //     userid : 요청.user._id, date : new RegExp('2025')
    // }).toArray()
    // let myqtCount = myqt.length // 올해 나의 qt 묵상횟수

    // let userdata = await db.collection('user').find({}).toArray()
    // let ids = [];
    // let rank = [];
    // for(let i =0;i<userdata.length;i++){
    //     ids.push([userdata[i]._id, userdata[i].username])
    // }
    // for(let i =0;i<ids.length;i++){
    //     let myqt = await db.collection('contemplation').find({
    //         userid : new ObjectId(ids[i][0]), date : new RegExp('2025')
    //     }).toArray()
    //     let myqtCount = myqt.length
    //     rank.push([myqtCount, ids[i][0], ids[i][1]] )
    // }

    let userdata = await db.collection('user').find({}).toArray()
    let rank = [];
    for(let i =0;i<userdata.length;i++){
        rank.push([userdata[i]._id, userdata[i].username, userdata[i].count])
    }
    rank.sort((a,b) => b[2]-a[2]) // 내림차순으로 정렬
    // console.log(rank)
    top10 = rank.slice(0,10);
    응답.render('rank.ejs', {top10 : top10})
})

app.get('/words/list',checkLogin, async(요청, 응답)=>{
    let mylist = await db.collection('contemplation').find({
        userid : 요청.user._id
    }).toArray()

    let this_month = moment().format('YYYY-MM')
    let result = await db.collection('qt').find({
        // date : /^2024-06/
        date : new RegExp(this_month)
    }).toArray()
    result = result.reverse()
    if(요청.user && 요청.user.authority == "youth"){
        응답.render('words-list.ejs', { result : result , this_month : this_month, mylist : mylist})
    }
    else if(요청.user.authority == "MANAGER"){
        응답.render('words-list-manager.ejs', { result : result , this_month : this_month, mylist : mylist})
    }
    else{
        응답.render('login.ejs')
    }
})

app.get('/words/detail/:id',checkLogin, async(요청, 응답)=>{
    try{
        let myqt = await db.collection('contemplation').findOne({
            words_id : new ObjectId(요청.params.id), userid : 요청.user._id
        })
        let result = await db.collection('qt').findOne({
            _id : new ObjectId(요청.params.id)
        })
        응답.render('words-detail.ejs', { result : result , myqt : myqt})
    } catch(e){
        console.log(e)
        응답.status(404).send('이상한 url 입력함.') 
        // 400 -> 유저 오류 500 -> 서버오류
    }
    
})

app.delete('/words/delete', async(요청, 응답)=>{
    let post = await db.collection('qt').findOne({
        _id : new ObjectId(요청.query.docid)
    })
    await db.collection('qt').deleteOne({
        _id : new ObjectId(요청.query.docid), // 게시글 아이디 확인
    })
    응답.send('삭제완료')
})

// 마이페이지 묵상 게시글 삭제
app.delete('/contemplation/delete', async(요청, 응답)=>{
    await db.collection('contemplation').deleteOne({
        _id : new ObjectId(요청.query.docid), // 게시글 아이디 확인
    })
    await db.collection('user').updateOne({
        _id : 요청.user._id,
    },
    {$inc : { count : -1}
    })
    let result = await db.collection('contemplation').find({
        userid : 요청.user._id
    }).toArray()
    let user = 요청.user
    응답.render('mypage-list.ejs', {result: result, user:user})
})

// 유저 삭제
app.delete('/user/delete', async(요청, 응답)=>{
    await db.collection('user').deleteOne({
        _id : new ObjectId(요청.query.docid), // 게시글 아이디 확인
    })
    응답.redirect('/')
})


// 유저 권한 부여
app.get('/authority', async(요청,응답)=>{
    if(요청.user.authority=="MANAGER"){
        let result = await db.collection('user').updateOne({
            _id : new ObjectId(요청.query.docid),
        },
        {$set : { authority : "youth"}
        })
        응답.redirect('back')
    }
    else{
        응답.redirect('/home')
    }
})

// 유저 비밀번호 변경 페이지
app.get('/change/pw/:id', checkLogin, async(요청,응답)=>{
    if(요청.user.authority=="MANAGER"){
        let user = 요청.params.id
        console.log(user)
        응답.render('change-pw.ejs', {user: user})  
    }
    else{
        응답.redirect('/home')
    }
})



// 유저 비밀번호 변경
app.post('/change/pw',checkLogin, async (요청, 응답) => {
    try{
        if(요청.user.authority=="MANAGER"){
            let 해시 = await bcrypt.hash(요청.body.password, 10)
            await db.collection('user').updateOne({ 
                _id : new ObjectId(요청.body.id)
            },
            {$set : { password: 해시}
            })
            응답.redirect('/manager')
        }
        

    }catch(e){
        console.log(e)
        응답.status(404).send('이상한 url 입력함.') 
    }

})


// app.get('/words/today', async(요청,응답)=>{
//     let result = await db.collection('qt').findOne({
//         date : moment().format('YYYY-MM-DD')
//     })
//     응답.render('words-detail.ejs', { result : result })
// })

// 로그인 페이지
app.get('/login', async(요청,응답)=>{
    응답.render('login.ejs')
})

// 로그인 요청
app.post('/login', async(요청,응답, next)=>{

    let this_month = moment().format('YYYY-MM')
    let result = await db.collection('qt').find({
        // date : /^2024-06/
        date : new RegExp(this_month)
    }).toArray()
    passport.authenticate('local', (error, user, info)=>{
        
        if(error) return 응답.status(500).json(error) // 에러에 뭐가 들어오면 에러500 보내줌.
        if(!user) return 응답.status(401).json(info.message) // DB에 있는거랑 비교해봤는데 맞지 않는 경우
        
        // 밑에꺼 실행되면 세션만들기가 실행됨.
        // 요청.logIn()이 실행되면 쿠키생성 및 쿠기 확인까지 실행됨.
        
        요청.logIn(user, (err)=>{
            if(err) return next(err)
                
                if(요청.user.authority == "youth" || 요청.user.authority == "MANAGER" ){
                    
                    응답.redirect('/home')
                }

                else{
                    응답.render('login.ejs')
                }
                
        })

    })(요청, 응답, next)

})

// 로그아웃
app.get("/logout",checkLogin, function(req, res) {
    req.logout(()=>{
        res.redirect('/')
    })
});

// 회원가입 페이지
app.get('/register', async(요청,응답)=>{

    응답.render('register.ejs')

})

// 마이 페이지
app.get('/mypage/list',checkLogin, async(요청,응답)=>{

    let result = await db.collection('contemplation').find({
        userid : 요청.user._id
    }).toArray()
    result = result.reverse()
    let user = 요청.user
    응답.render('mypage-list.ejs', {result: result, user:user})
    
})

// 묵상-detail
app.get('/contemplation/detail/:id',checkLogin, async(요청, 응답)=>{
    try{
        let result = await db.collection('qt').findOne({
            _id : new ObjectId(요청.params.id)
        })
        let contemplation = await db.collection('contemplation').findOne({
            userid : 요청.user._id,
            words_id : new ObjectId(요청.params.id)
        })
        응답.render('contemplation.ejs', { result : result , contemplation: contemplation})
    } catch(e){
        console.log(e)
        응답.status(404).send('이상한 url 입력함.') 
        // 400 -> 유저 오류 500 -> 서버오류
    }
    
})


// 묵상 수정 요청
app.post('/contemplation/edit',checkLogin, async (요청, 응답) => {
    try{
        if(요청.user.authority=="MANAGER" || 요청.user.authority=="youth"){
            await db.collection('contemplation').updateOne({ 
                _id : new ObjectId(요청.body.id)
            },
            {$set : { givewords : 요청.body.givewords, pray : 요청.body.pray}
            })
            응답.redirect('/mypage/list')
        }

    }catch(e){
        console.log(e)
        응답.status(404).send('이상한 url 입력함.') 
    }

})

// 묵상수정 페이지.
app.get('/contemplation/edit/:id',checkLogin, async(요청, 응답)=>{
    try{
        let contemplation = await db.collection('contemplation').findOne({
            userid : 요청.user._id,
            _id : new ObjectId(요청.params.id)
        })
        응답.render('contemplation-edit.ejs', { contemplation: contemplation})
    } catch(e){
        console.log(e)
        응답.status(404).send('이상한 url 입력함.') 
        // 400 -> 유저 오류 500 -> 서버오류
    }
    
})



// 회원가입(DB에 회원정보 저장)
app.post('/register' , async(요청, 응답)=>{

    let 해시 = await bcrypt.hash(요청.body.password, 10)
    // 기존의 비밀번호를 해싱을 해서 암호화 하는 작업.
    let result = await db.collection('user').findOne({ userid : 요청.body.userid })  

    if(요청.body.userid == '' || 요청.body.username == '' || 요청.body.password == ''){
        응답.send('입력되지 않은 칸이 있습니다. 다시 확인해주세요.')
    }
    else if(요청.body.password != 요청.body.password_check){
        응답.send('입력되지 않은 칸이 있습니다. 다시 확인해주세요.')
    }
    else if(!result){
        await db.collection('user').insertOne({ 
            
            username : 요청.body.username,
            userid : 요청.body.userid,
            password : 해시, //해싱한 값을 비번에 저장.   
            authority : "normal",
            count : 0
        })
        응답.redirect('/')
    }
    else{
        응답.send('이미 존재하는 아이디입니다. 다시 입력해주세요.')
    } 

})

// 오늘의 묵상
app.post('/post/mind',checkLogin, async (요청, 응답) => {
    if(요청.user == undefined || 요청.user.authority == "normal"){
        응답.render('login.ejs')
    }
    else{
        try{
            if(요청.body.givewords=='' || 요청.body.pray == ''){
                응답.send('내용 전부 입력안했는데?')
            }else{
                
                let this_month = moment().format('YYYY-MM')
                let result = await db.collection('qt').find({
                    // date : /^2024-06/
                    date : new RegExp(this_month)
                }).toArray()
                result = result.reverse()
                await db.collection('contemplation').insertOne(

                    { 
                        words_title: 요청.body.title,
                        date : 요청.body.date,
                        givewords : 요청.body.givewords, 
                        pray : 요청.body.pray,
                        userid : 요청.user._id,
                        words_id: new ObjectId(요청.body.words_id)
                    }
                )
                await db.collection('user').updateOne({
                    _id : 요청.user._id,
                },
                {$inc : { count : 1}
                })
                let mylist = await db.collection('contemplation').find({
                    userid : 요청.user._id
                }).toArray()

                if(요청.user && 요청.user.authority == "youth"){
                    // 응답.render('words-list.ejs', { result : result , this_month : this_month, mylist: mylist})// 로그인 완료시 실행할 코드
                    응답.redirect('/home')
                }
                else if(요청.user.authority == "MANAGER"){
                    // 응답.render('words-list-manager.ejs', { result : result , this_month : this_month, mylist: mylist})
                    응답.redirect('/home')
                }
            }
                
        } catch(e){
            console.log(e)
            응답.status(500).send('서버에러남') 
        }
    }
})


function checkLogin(요청, 응답, next){
    if(요청.user && 요청.user.authority == "youth"){
        next()
    } else if(요청.user && 요청.user.authority == "MANAGER"){
        next()
    }else {
        응답.render('login.ejs')
    }
}