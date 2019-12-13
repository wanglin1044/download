const https = require('https')

var options = {
    headers: {
        'Origin': 'https://www.bilibili.com',
        'Referer': `https://www.bilibili.com/video/${this.code}`,
        'Sec-Fetch-Mode': 'cors',
        'Range': 'bytes=976-1163',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.132 Safari/537.36'
      }
}

https.get('https://cn-hbcd2-cu-v-11.acgvideo.com/upgcxcode/08/28/134682808/134682808-1-30080.m4s?expires=1576267200&platform=pc&ssig=AAyBe4MgnBW7qOvpBWWM6Q&oi=2089236332&trid=ea96ca528443423aa5029bd659e04070u&nfc=1&nfb=maPYqpoel5MI3qOUX6YpRA==&mid=19618565', options, res => {
    const { statusCode } = res;
    const contentType = res.headers['content-type'];

    let error;
    // if (statusCode !== 200 || statusCode !== 206) {
    //     error = new Error('请求失败\n' + `状态码: ${statusCode}`);
    // } else if (!/^application\/json/.test(contentType)) {
    //     error = new Error('无效的 content-type.\n' + `期望的是 application/json 但接收到的是 ${contentType}`);
    // }
    if (error) {
        console.error(error.message);
        // 消费响应数据来释放内存。
        res.resume();
        return;
    }

    console.log(res.headers)
    res.resume();
    return
    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const parsedData = JSON.parse(rawData);
            console.log(parsedData);
        } catch (e) {
            console.error(e.message);
        }
    });
})