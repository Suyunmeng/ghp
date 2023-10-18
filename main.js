function convertScript() {
  inputStr = document.querySelector("#githubScript").value;
  if (inputStr == "") {
    return;
  }

  ghproxy = document.querySelector("#ghproxy").value;
  perlcmdbegin = ' | perl -pe "$(curl -L ';
  perlcmdend = ')"';
  perlrule = ghproxy + 'perl-pe-para';

  // 先给裸的git类链接前面加上 https://
  inputStr = inputStr.replace(/ git/g, ' https://git');

  // 再进行加github proxy的转换
  // 处理 bash <( curl xxx.sh) 或 bash <( wget -O- xxx.sh)
  regex1 = /(bash.*?)(https?:\/\/.*?)(\).*)/s;

  // 考虑github脚本嵌套调用的情况, 即A脚本调用B脚本, B脚本调用C脚本
  replacement1 = '$1' + ghproxy + '$2' + perlcmdbegin + perlrule + perlcmdend + '$3';
  resultStr1 = inputStr.replace(regex1, replacement1);
  if (resultStr1 !== inputStr) {
    document.querySelector("#result1").value = resultStr1;
  }

  // 只考虑处理一层Github脚本的情况
  replacement2 = '$1' + ghproxy + '$2' + ' | perl -pe "s#(http.*?git[^/]*?/)#' + ghproxy + '\\1#g"' + '$3';
  resultStr2 = inputStr.replace(regex1, replacement2);
  if (resultStr2 !== inputStr) {
    document.querySelector("#result2").value = resultStr2;
  }

  // 处理 wget xxx.sh && bash xxx.sh 或 wget xxx.sh && chmod +x xxx.sh && ./xxx.sh
  regex2 = /(wget.*?)(https?:\/\/.*)(&&[^&]*[ /])(.*?sh)/s;
  //replacement3 = '1 : $1 ; 2 : $2 ; 3 : $3 ; 4 : $4 ;'
  replacement3 = '$1' + ghproxy + '$2' + '&& perl -i -pe "s#(http.*?git[^/]*?/)#' + ghproxy + '\\1#g" ' + '$4 $3$4';
  resultStr2 = inputStr.replace(regex2, replacement3);
  if (resultStr2 !== inputStr) {
    document.querySelector("#result2").value = resultStr2;
  }

  // 处理 curl -sS -O xxx.sh && bash xxx.sh 或 curl -sS -O xxx.sh && chmod +x xxx.sh && bash xxx.sh 
  regex2 = /^(curl.*?)(https?:\/\/.*)(&&[^&]*[ /])(.*?sh)/s;
  //replacement3 = '1 : $1 ; 2 : $2 ; 3 : $3 ; 4 : $4 ;'
  replacement3 = '$1' + ghproxy + '$2' + '&& perl -i -pe "s#(http.*?git[^/]*?/)#' + ghproxy + '\\1#g" ' + '$4 $3$4';
  resultStr2 = inputStr.replace(regex2, replacement3);
  if (resultStr2 !== inputStr) {
    document.querySelector("#result2").value = resultStr2;
  }
}

function copyResult1() {
  resultStr = document.querySelector("#result1").value;
  navigator.clipboard.writeText(resultStr);
}

function copyResult2() {
  resultStr = document.querySelector("#result2").value;
  navigator.clipboard.writeText(resultStr);
}

function getLocalUrl() {
  document.querySelector("#ghproxy").value = window.location.href;
}

function convertRes() {
  inputStr = document.querySelector("#githubRes").value;
  if (inputStr == "") {
    return;
  }

  ghproxy = document.querySelector("#ghproxy").value;

  // 先给裸的git类链接前面加上 https://
  inputStr = inputStr.replace(/ git/g, ' https://git');

  resultStr = ghproxy + inputStr;

  document.querySelector("#resAfterGhproxy").value = resultStr;
}

function fetchRes() {
  window.open(document.querySelector("#resAfterGhproxy").value);
}

getLocalUrl()
