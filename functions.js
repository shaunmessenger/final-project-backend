const sha256 = require('sha256')
const MongoClient = require('mongodb').MongoClient
const url = 'mongodb://admin:password1@ds119662.mlab.com:19662/final-project-db'
let dbo

function setup(cb) {
    MongoClient.connect(url, (err, db) => {
        if (err) throw err
        dbo = db.db('final-project-db')
        cb()
    })
}

function signup(username, password) {
    let userID = Math.floor(Math.random() * 10000)
    let signupDate = Date()
    let shaPassword = sha256(password)
    // stores all the signup information in the database
    dbo.collection('users').insertOne({ userID, username, signupDate, password: shaPassword, firstLogin: true }, (err, result) => {
        if (err) throw err
        console.log('success')
    })
}

function login(username, password, cb) {
    let sessionID = Math.floor(Math.random() * 10000)
    // checks the collection to see if there is a username that matches the input username. there should only be one match (if any)
    dbo.collection('users').findOne({ username: username }, (err, result) => {
        if (err) throw (err)
        // if it finds a result
        if (result) {
            // checks to see if the stored password matches the input password
            if (result.password === sha256(password)) {
                // checks if firstLogin is set to true (if it *is* first login)
                if (result.firstLogin) {
                    // next five lines updates firstLogin
                    let update = { $set: { firstLogin: !result.firstLogin } };
                    dbo.collection('users').updateOne({ username: username }, update, (err, res) => {
                        if (err) throw err
                        console.log("one property updated")
                    })
                    // send a result back to server (endpoint)
                    let toSend = {
                        userID: result.userID, sessionID, mustMakeGoalProfile: true, mustMakeFixedProfile: true
                    }
                    cb(toSend)// and userID, and sessionID
                } else {
                    // send a result back to server (endpoint)
                    let toSend = {
                        // will need to send dailyBudget
                        userID: result.userID, sessionID
                    }
                    cb(toSend)
                }
            } else {
                let msg = "wrong password"
                cb ({msg})
            }
        } else {
            let msg = "no such user"
            cb({msg})
        }
    })
}

function storeGoal(userID, goal, cb) {
    // looks for the user with the userID
    dbo.collection('users').findOne({ userID: userID }, (err, result) => {
        if (err) throw err
        if (result) {
            let update = { $set: { goal, mustMakeGoalProfile: false } }
            // careful: overwrites whatever the goal is already, if there is one
            dbo.collection('users').updateOne({ userID: userID }, update, (err, res) => {
                if (err) throw err
                cb("goal updated")
            })
        }
    })
}

function calculateDailySaveGoal(userID, goal, cb) {
    dbo.collection('users').findOne({ userID: userID }, (err, result) => {
        if (err) throw err
        if (result) {
            let startDate = Date.parse(result.signupDate)
            let endDate = Date.parse(goal.endDate)
            let amount = goal.amount
            let daysInBetween = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
            let dailySaveGoal = Math.ceil(amount / daysInBetween)
            // returns the calculated amount as an object, { dailySaveGoal : 450 }
            cb( {dailySaveGoal})
            let update = { $set: { dailySaveGoal } }
            // stores the dailySaveGoal in the server, as a property of the user
            dbo.collection('users').updateOne({ userID: userID }, update, (err, res) => {
                if (err) throw err
            })
        }
    })
}

function storeFixed(userID, fixedExpense, fixedIncome, cb) {
    // find the user in the database
    dbo.collection('users').findOne({ userID: userID}, (err, result) => {
        if (err) throw err
        if (result){
            // write the fixed income/expense to the database, change mustMakeFixedProfile to false
            let update = { $set: { fixedExpense, fixedIncome, mustMakeFixedProfile: false }}
            dbo.collection('users').updateOne({ userID: userID }, update, (err, res) => {
                if (err) throw err
                cb("fixed updated")
            })
        }
    })
}

function calculateDailyDisposable(userID, fixedExpense, fixedIncome, cb) {
    dbo.collection('users').findOne({ userID: userID }, (err, result) => {
        if (err) throw err
        if (result) {
            let monthlyIncome;
            if (fixedIncome.type === 'biweekly') {
                monthlyIncome = (fixedIncome.amount / 14) * 30
            }
            if (fixedIncome.type === 'yearly') {
                monthlyIncome = fixedIncome.amount / 12
            }
            let arrFixedExpenses = Object.values(fixedExpense)
            let sumFixedExp = 0
            for (let i = 0; i < arrFixedExpenses.length; i++) {
                sumFixedExp += arrFixedExpenses[i]
            }
            let monthlyDisposable = monthlyIncome - sumFixedExp
            let dailyDisposable = Math.floor(monthlyDisposable / 30)

            cb({ dailyDisposable })
            let update = { $set: { dailyDisposable }}
            dbo.collection('users').updateOne({ userID: userID }, update, (err, res) => {
                if (err) throw err
            })

            
        }
    })
}

function calculateTodaysBudget(dailyDisposable, todaysSpending, rollover) {
    return dailyDisposable - todaysSpending + rollover
}

module.exports = {
    setup,
    signup,
    login,
    storeGoal,
    calculateDailySaveGoal,
    storeFixed,
    calculateDailyDisposable
}