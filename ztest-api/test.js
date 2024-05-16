const autocannon = require('autocannon')
const fs = require('fs/promises');
const route = {
    1: "/",
    2: "/withPopulate",
    3: "/withPopulateSelect",
    4: "/withPopulateAndUnwind",
    5: "/findOne",
    6: "/findById",
    7: "/findFirstFromFirst",
    8: "/findLastFromFirst",
    9: "/findAndPopulate",
    10: "/doubleFind",
    11: "/test2"
}
//change path here
const route_index = 11
autocannon({
    url: 'http://localhost:3000/test-api/'+route[route_index],
    connections: 10,
    duration: 10,
}, (err,result) => {
    console.log(result);
    fs.readFile("api_test_result.json").then(data => {
        let test = JSON.parse(data)
        const key = route[route_index]
        test[key] = {};
        test[key].connections = result.connections;
        test[key].duration = result.duration;
        test[key].latency = {};
        test[key].latency.average = result.latency.average;
        test[key].req_per_sec = {};
        test[key].req_per_sec.average = result.requests.average;
        test[key].KB_per_sec = {};
        test[key].KB_per_sec.average = result.throughput.average / 1000;
        test[key].totalRequest = result.requests.total;
        test[key].totalKB = result.throughput.total / 1000;
        test[key].KB_per_req = result.throughput.total / result.requests.total / 1000;
        console.log(test);
        fs.writeFile("api_test_result.json",JSON.stringify(test));    
    })
})
