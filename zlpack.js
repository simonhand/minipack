// const fs = require('fs')
import fs from 'fs';
import parser from '@babel/parser'
import path from "path";
import babel from '@babel/core'
import _traverse from '@babel/traverse'
// const traverse  = require('@')
let ID = 0;

const traverse = _traverse.default

function createAsset(filename) {
  const content = fs.readFileSync(filename, 'utf8')
  const ast = parser.parse(content, {
    sourceType: 'module'
  });

  const dependencies = [];

  // visitor访问者
  traverse(ast, {
    // 这里拿到依赖文件的信息
    ImportDeclaration: ({ node }) => {
      // console.log('value: ', node.source.value);
      dependencies.push(node.source.value);
    }
  });
  // console.log('dependencies: ', dependencies);

  const { code } = babel.transformFromAstSync(ast, null, {
    presets: ['@babel/preset-env'],
    plugins: [],
  })
  // console.log('code: ', code);
  // console.log('ast: ', ast);
  const id = ID++
  return {
    id,
    filename,
    content,
    ast,
    code,
    dependencies,
  };
}
const createGraph = (entry) => {
  const asset = createAsset(entry);
  const queue = [asset];
  for (const asset of queue) {
    const dirname = path.dirname(asset.filename);
    // console.log('asset.dependencies: ', asset.dependencies); 
    asset.mapping = {}
    asset.dependencies.forEach(reletivePath => {
      const absoultePath = path.join(dirname, reletivePath);
      const child = createAsset(absoultePath);
      asset.mapping[reletivePath] = child.id;
      queue.push(child);
    })
  }
  return queue
}

function bundle(graph = []) {
  let modules = '';

  graph.forEach(mod => {
    modules += `
      ${mod.id}: [
        function (require, module, exports) {
          ${mod.code}
        },
        ${JSON.stringify(mod.mapping)}
      ]
    `
  })

  const result = `
  (function(modules) {
    function require(id) {
      const [fn, mapping] = modules[id];

      function localRequire(relativePath) {
        return require(mapping[relativePath]);
      }

      const module = {
        exports: {}
      }

      fn(localRequire, module, module.exports);

      return module.exports;
    }
    require(0);
  })({${modules}})
  `

  return result;
}

const queue = createGraph('./src/index.js')
console.log('queue: ', queue);
const res = bundle(queue);
console.log('res: ', res);