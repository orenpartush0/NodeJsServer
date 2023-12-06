const express = require('express');
const app = express();
const winston = require('winston');
const { format } = require('winston');
let counter = 1;
let RequestCounter=1;
let ToDoList = [];
errorMessage='';
error=false;
app.use(express.json());
app.listen(9583, () => console.log(`Server listening on port ${9583}`));


const Requestlogger = winston.createLogger({
    level: 'info',
    name: 'request-logger',
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({filename:'requests.log', dirname: 'logs'})
    ],
    format: format.combine(
        format.timestamp({
          format: 'DD-MM-YYYY HH:mm:ss.SSS'
        }),
        format.printf(info => `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`)
      ),
  });
  const TODOlogger = winston.createLogger({
    level: 'info',
    name: 'TODO-logger',
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({filename:'todos.log', dirname: 'logs'})
    ],
    format: format.combine(
        format.timestamp({
          format: 'DD-MM-YYYY HH:mm:ss.SSS'
        }),
        format.printf(info => `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`)
      ),
  });

function CreateLog(logger,LogInfoMessage,LogDebugMessage,requestNumber,info=true,debug=true,error=false,errorMessage=''){
    if(info)
        logger.info(LogInfoMessage+' | request #'+requestNumber)
    if(debug)
        logger.debug(LogDebugMessage+' | request #'+requestNumber)
    if(error)
        logger.error(errorMessage+' | request #'+requestNumber)
  }

function ToDo(Id, Title, Content, Due_date, Status) {
    this.id = Id;
    this.title = Title;
    this.content = Content;
    this.status = Status;
    this.dueDate = Due_date;
}
function count(arr, status) {
    if(status==='ALL')
        return ToDoList.length;
    else
    {
    let count = 0;
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].status === status)
            count++;
    }   
    return count;
    }
}
function createList(status) {
    let result = [];
    for (let i = 0; i < ToDoList.length; i++) {
        if (ToDoList[i].status === status)
            result.push(ToDoList[i]);
    }
    return result;
}
function checkDue_Date(time) {
    const currentTime = new Date().getTime();
    return currentTime > time;
}

app.get('/todo/health', (req, res) => {
    const startTime = new Date();
    res.status(200).send('OK');
    const endTime = new Date();
    const timeDiff = endTime.getTime() - startTime.getTime();
    RequestInfoMessage='Incoming request | #'+RequestCounter+' | resource: /todo/health | HTTP Verb GET';
    RequestDebugMessage='request #'+RequestCounter+' duration: '+timeDiff+'ms';
    CreateLog(Requestlogger,RequestInfoMessage,RequestDebugMessage,RequestCounter);
    RequestCounter++;
    res.end();
})

app.post('/todo', (req, res) => {
    const startTime = new Date();
    if (ToDoList.some(p => p.title === req.body.title)){
        res.status(409).json({errorMessage:'Error: TODO with the title [' + req.body.title + '] already exists in the system'}).end();
        error=true;
        errorMessage = 'Error: TODO with the title [' + req.body.title + '] already exists in the system';
    }
    else if (checkDue_Date(parseInt(req.body.dueDate))){
        res.status(409).json({errorMessage : 'Error: Can’t create new TODO that its due date is in the past'}).end();
        error=true;
        errorMessage = 'Error: Can’t create new TODO that its due date is in the past'
    }
    else {
        ToDoList.push(new ToDo(counter, req.body.title, req.body.content, req.body.dueDate, "PENDING"));
        res.status(200).json({result :counter})
        counter++;
    }
    const endTime = new Date();
    const timeDiff = endTime.getTime() - startTime.getTime();
    RequestInfoMessage='Incoming request | #'+RequestCounter+' | resource: /todo | HTTP Verb POST';
    RequestDebugMessage='request #'+RequestCounter+' duration: '+timeDiff+'ms';
    CreateLog(Requestlogger,RequestInfoMessage,RequestDebugMessage,RequestCounter);
    TODOinfoMessage='Creating new TODO with Title ['+req.body.title+']';
    TODOdebugMessage='Currently there are '+(ToDoList.length-1)+' TODOs in the system. New TODO will be assigned with id '+(counter-1);
    CreateLog(TODOlogger,TODOinfoMessage,TODOdebugMessage,RequestCounter,!error,!error,error,errorMessage);
    RequestCounter++;
    error=false;
    res.end();
})
app.get('/todo/size', (req, res) => {
    const startTime = new Date();
    if (req.query.status === 'ALL')
        res.status(200).json({result:ToDoList.length});
    else if (req.query.status === 'PENDING') {
        res.status(200).json({result:count(ToDoList, 'PENDING')});}
    else if (req.query.status === 'LATE')
        res.status(200).json({result:count(ToDoList, 'LATE')});
    else if (req.query.status === 'DONE')
        res.status(200).json({result:count(ToDoList, 'DONE')});
    else{
        res.status(400).end();
        return;
    }
    const endTime = new Date();
    const timeDiff = endTime.getTime() - startTime.getTime();
    RequestInfoMessage='Incoming request | #'+RequestCounter+' | resource: /todo/size | HTTP Verb GET';
    RequestDebugMessage='request #'+RequestCounter+' duration: '+timeDiff+'ms';
    CreateLog(Requestlogger,RequestInfoMessage,RequestDebugMessage,RequestCounter);
    TODOinfoMessage='Total TODOs count for state '+req.query.status+' is '+count(ToDoList,req.query.status);
    CreateLog(TODOlogger,TODOinfoMessage,'',RequestCounter,true,false);
    RequestCounter++
    res.end();
})

app.get('/todo/content', (req, res) => {
    const startTime = new Date();
    let Sort=req.query.sortBy;
    if (!req.query.status){
        res.status(400).end();
        return;
    }
    else if (req.query.status !== 'ALL' && req.query.status !== 'PENDING' && req.query.status !== 'LATE' && req.query.status !== 'DONE'){
        res.status(400).end();
        return;
    }
    let temp;
    if (req.query.status === 'ALL')
        temp = ToDoList;
    else
        temp = createList(req.query.status);
    if (!req.query.sortBy || req.query.sortBy === 'ID'){
        res.status(200).json({result : temp.sort((a, b) => a.id-b.id)});
        Sort='ID';
    }
    else if (req.query.sortBy === 'DUE_DATE')
        res.status(200).json({result :temp.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))});
    else if (req.query.sortBy === 'TITLE')
        res.status(200).json({result : temp.sort((a, b) => a.title.localeCompare(b.title))});
    else if (req.query.sortBy !== 'ID' && req.query.sortBy !== 'DUE_DATE' && req.query.sortBy !== 'TITLE'){
        res.status(400).end();
        return;
    }

    const endTime = new Date();
    const timeDiff = endTime.getTime() - startTime.getTime();
    RequestInfoMessage='Incoming request | #'+RequestCounter+' | resource: /todo/content | HTTP Verb GET';
    RequestDebugMessage='request #'+RequestCounter+' duration: '+timeDiff+'ms';
    CreateLog(Requestlogger,RequestInfoMessage,RequestDebugMessage,RequestCounter);
    TODOinfoMessage='Extracting todos content. Filter: '+req.query.status+' | Sorting by: '+Sort;
    TODOdebugMessage='There are a total of '+ToDoList.length+' todos in the system. The result holds '+temp.length+' todos'
    CreateLog(TODOlogger,TODOinfoMessage,TODOdebugMessage,RequestCounter);
    RequestCounter++
    res.end();
})

app.put('/todo', (req, res) => {
    const startTime = new Date();
    if (req.query.status !== 'PENDING' && req.query.status !== 'LATE' && req.query.status !== 'DONE'){
        res.status(400).end();
        return;
    }
    else if (!ToDoList.some(p => p.id === parseInt(req.query.id))){
        res.status(404).json({errorMessage :'Error: no such TODO with id ' + req.query.id});
        error=true;
        errorMessage = 'Error: no such TODO with id ' + req.query.id;
    }
    const TODOToUpdate = ToDoList.find(ToDo => ToDo.id === parseInt(req.query.id));
    const endTime = new Date();
    const timeDiff = endTime.getTime() - startTime.getTime();
    RequestInfoMessage='Incoming request | #'+RequestCounter+' | resource: /todo | HTTP Verb PUT';
    RequestDebugMessage='request #'+RequestCounter+' duration: '+timeDiff+'ms';
    CreateLog(Requestlogger,RequestInfoMessage,RequestDebugMessage,RequestCounter);
    let temp='';
    if (TODOToUpdate) {
       temp = TODOToUpdate.status;
       TODOToUpdate.status = req.query.status;
       res.json({result: temp});
   }
   TODOinfoMessage='Update TODO id ['+req.query.id+'] state to '+req.query.status;
   TODOdebugMessage='Todo id ['+req.query.id+'] state change: '+temp+' --> '+req.query.status;
   CreateLog(TODOlogger,TODOinfoMessage,TODOdebugMessage,RequestCounter,true,!error,error,errorMessage);
    RequestCounter++;
    error=false;
    res.end();
})

app.delete('/todo', (req, res) => {
    const startTime = new Date();
    const id = parseInt(req.query.id);
    const index = ToDoList.findIndex(todo => todo.id === id);
    if (index === -1) {
        res.status(404).json({errorMessage : `Error: no such TODO with id ${id}`});
        error=true;
        errorMessage = `Error: no such TODO with id `+id;
    } else {
        ToDoList.splice(index, 1);
        res.status(200).json({result : ToDoList.length});
    }
    const endTime = new Date();
    const timeDiff = endTime.getTime() - startTime.getTime();
    RequestInfoMessage='Incoming request | #'+RequestCounter+' | resource: /todo | HTTP Verb DELETE';
    RequestDebugMessage='request #'+RequestCounter+' duration: '+timeDiff+'ms';
    CreateLog(Requestlogger,RequestInfoMessage,RequestDebugMessage,RequestCounter);
    TODOinfoMessage='Removing todo id '+req.query.id;
    TODOdebugMessage='After removing todo id ['+req.query.id+'] there are '+ToDoList.length+' TODOs in the system';
    CreateLog(TODOlogger,TODOinfoMessage,TODOdebugMessage,RequestCounter,!error,!error,error,errorMessage);
    RequestCounter++;
    error=false;
    res.end();
});

app.get('/logs/level',(req,res)=>{
    const startTime = new Date();
    if(req.query['logger-name']==='request-logger')
        res.status(200).send(Requestlogger.level.toUpperCase()).end;
    else if(req.query['logger-name']==='todo-logger')
        res.status(200).send('Success:'+TODOlogger.level.toUpperCase()).end;
    else{
        res.status(400).send('Failure').end;
    }
    const endTime = new Date();
    const timeDiff = endTime.getTime() - startTime.getTime();
    RequestInfoMessage='Incoming request | #'+RequestCounter+' | resource: /logs/level | HTTP Verb GET';
    RequestDebugMessage='request #'+RequestCounter+' duration: '+timeDiff+'ms';
    CreateLog(Requestlogger,RequestInfoMessage,RequestDebugMessage,RequestCounter);
    RequestCounter++;
})
app.put('/logs/level',(req,res)=>{
    const startTime = new Date();
    debug=false;
    if(Requestlogger.level==='debug')
        debug=true;
    if(req.query['logger-name']==='request-logger'){
        Requestlogger.level=req.query['logger-level'].toLowerCase();
        res.status(200).send('Success:'+Requestlogger.level.toUpperCase()).end;
    }
    else if(req.query['logger-name']==='todo-logger'){
        TODOlogger.level=req.query['logger-level'].toLowerCase();;
        res.status(200).send('Success:'+TODOlogger.level.toUpperCase()).end;
    }
    else{
        res.status(400).send('Failure').end;
    }
    const endTime = new Date();
    const timeDiff = endTime.getTime() - startTime.getTime();
    RequestInfoMessage='Incoming request | #'+RequestCounter+' | resource: /logs/level | HTTP Verb PUT';
    RequestDebugMessage='request #'+RequestCounter+' duration: '+timeDiff+'ms';
    CreateLog(Requestlogger,RequestInfoMessage,RequestDebugMessage,RequestCounter,true,debug);
    RequestCounter++;
})
