let cheerio = require('cheerio');
let request = require('request');
let wget = require('node-wget');
let dir = "./tmp/";

let sliceString = (str, from, end) => {
    return str.substring(str.indexOf(from) + from.length, str.indexOf(end));
};
let sliceStr = (str, from, size) => {
    return str.substr(str.indexOf(from) + from.length, size);
};
let promiseSeq = promises => {
    const oneFunc = (fc, args) => {
        return new Promise(resolve => {
            resolve(fc(args));
        });
    };
    // promise가 실행된다.
    let current = oneFunc(promises[0].func, promises[0].args);
    for (let i = 1; i < promises.length; i++) {
        // current의 then에 다음 프로미스를 실행시키고 그 결과를 current로 가져온다
        current = current.then(() => {
            return oneFunc(promises[1].func, promises[i].args);
        });
    }
    return current;
};
let promiseSeqOneSec = promises => {
    let oneSecFunc = (fc, args, sec) => {
        return new Promise(resolve => {
            setTimeout(
                () => {
                    console.log(sec + " second(s) passed");
                    resolve(fc(args));
                },
                1000 * sec,
                {}
            );
        });
    };
    if (promises === undefined) {
        console.log("promises is undefined");
        return null;
    }
    let processPromises = [];
    for (let i = 0; i < promises.length; i++) {
        processPromises.push(
            oneSecFunc(promises[i].func, promises[i].args, i)
        );
    }
    return Promise.all(processPromises);
};

let downloadPdf = (args) => {
    let url = args.url;
    let name = args.name;
    if (name == undefined) {
        name = url;
    }
    name = name.replace(/\|/gi, "-");
    name = name.replace(/\>/gi, "-");
    name = name.replace(/\</gi, "-");
    name = name.replace(/\?/gi, "-");
    name = name.replace(/\\/gi, "-");
    name = name.replace(/\//gi, "-");
    name = name.replace(/\:/gi, "-");
    name = name.replace(/\"/gi, "-");
    name = name.replace(/\*/gi, "-");
    console.log("name", name);

    return new Promise((res, rej) => {
        wget({
            url: url,
            dest: dir + name + ".pdf",      // destination path or path with filenname, default is ./
            timeout: 30000       // duration to wait for request fulfillment in milliseconds, default is 2 seconds
        },
            function (error, response, body) {
                if (error) {
                    console.log('--- error:');
                    console.log(error);            // error encountered
                    rej(error);
                } else {
                    console.log('./tmp/' + name + ".pdf");
                    res('./tmp/' + name + ".pdf");
                }
            }
        );
    });
};
let search = (args) => {
    let site = encodeURIComponent(args.site);
    let str = encodeURIComponent(args.str);
    let page = encodeURIComponent(args.page);
    let options = {
        url: 'https://www.google.com/search?q=site:' + site + '+filetype:pdf+' + str + '&start=' + page * 10,
        encoding: null
    };
    return new Promise((resolve, reject) => {
        request(options, (err, res, body) => {
            if (!err && res.statusCode === 200) {
                let $ = cheerio.load(body);
                let result = $("#search .g .r a");

                resolve(result);
            } else {
                reject(err);
            }
        });
    }).then(r => {
        return r.map((i, ele) => {
            return {
                name: ele.children[0].data,
                url: sliceString(ele.attribs.href, '/url?q=', '&sa=')
            }
        });
    }).then(list => {
        let result = [];
        for (let i = 0; i < list.length; i++) {
            result.push({
                func: downloadPdf,
                args: {
                    url: list[i].url,
                    name: list[i].name
                }
            });
        }
        return result;
    }).then(r => {
        return promiseSeqOneSec(r);
    });
};

let parsePdf = (site, str, startPage, endPage) => {
    let promises = [];
    for (let i = startPage; i < endPage + 1; i++) {
        promises.push({
            func: search,
            args: {
                site: site,
                str: str,
                page: i
            }
        });
    }
    return promiseSeq(promises);
}
console.log(typeof parseInt(process.argv[4]));
console.log(typeof parseInt(process.argv[5]));

parsePdf(
    process.argv[2],
    process.argv[3],
    parseInt(process.argv[4]),
    parseInt(process.argv[5])
);
