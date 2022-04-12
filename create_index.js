const { ESCreateIndex } = require("./elasticsearch7");

const func = async ()=> {
    await ESCreateIndex();
    console.log("created index");
}
func();