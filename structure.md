这是一个关于如何编写题目导入 JSON 的详细指南。本系统支持多种题型，每种题型在 content（题干）、options（选项）和 correct_options（正确答案）的编写上都有特定的格式要求。

---

### 1. 基础数据结构

所有题目都应包含在一个数组中，每个对象代表一道题：

codeJSON

```
[
  {
    "type": "题型代码",
    "content": "题干内容",
    "options": "选项（JSON字符串或数组）",
    "correct_options": "正确答案（JSON字符串或对象）",
    "answer_content": "解析内容（可选）"
  }
]
```

---

### 2. 各题型详细说明

#### A. 单选题 (single)

- **options**: 包含 id 和 content 的对象数组。

- **correct_options**: 包含正确选项 id 的数组（长度为1）。

codeJSON

```
{
  "type": "single",
  "content": "中国的首都是哪里？",
  "options": [
    {"id": "1", "content": "上海"},
    {"id": "2", "content": "北京"},
    {"id": "3", "content": "广州"}
  ],
  "correct_options": ["2"],
  "answer_content": "北京是中国的首都。"
}
```

#### B. 多选题 (multiple)

- **options**: 同单选。

- **correct_options**: 包含所有正确选项 id 的数组。

codeJSON

```
{
  "type": "multiple",
  "content": "以下哪些是水果？",
  "options": [
    {"id": "a", "content": "苹果"},
    {"id": "b", "content": "西红柿"},
    {"id": "c", "content": "香蕉"}
  ],
  "correct_options": ["a", "c"]
}
```

#### C. 普通填空题 (fill - 单花括号 {})

- **content**: 使用 {key} 标记空格，key 必须唯一。

- **correct_options**: 键值对对象。键为 key，值为正确答案数组（支持同义词）。

codeJSON

```
{
  "type": "fill",
  "content": "水的化学式是 {formula}，常温下是 {state}。",
  "correct_options": {
    "formula": ["H2O"],
    "state": ["液体", "液态"]
  }
}
```

#### D. 多空同义填空题 (fill - 双花括号 {{}})

- **content**: 使用 {{key}} 标记空格，多个空格可以使用相同的 key。

- **correct_options**: 键为 key，值为包含所有可选正确答案的数组。

- **规则**: 用户在多个同名空格中必须填写不同的正确答案。

codeJSON

```
{
  "type": "fill",
  "content": "影响气候的主要因素包括 {{factor}} 和 {{factor}}。",
  "correct_options": {
    "factor": ["纬度", "海陆位置", "地形"]
  }
}
```

#### E. 选词填空/下拉选择 (cloze)

- **content**: 使用 {key:{"选项1","选项2"}} 格式。

- **correct_options**: 键为 key，值为正确选项的字符串。

codeJSON

```
{
  "type": "cloze",
  "content": "当电阻不变时，电压升高，电流会 {trend:{"增大","减小"}}。",
  "correct_options": {
    "trend": "增大"
  }
}
```

#### F. 小猫钓鱼/拖拽排序 (fishing)

- **content**: 使用 {space} 标记放置区域。

- **options**: 备选词汇数组（字符串或对象）。

- **correct_options**: 数组，按 {space} 出现的顺序排列正确选项的 id 或索引。

codeJSON

```
{
  "type": "fishing",
  "content": "请按顺序排列：{space} -> {space} -> {space}",
  "options": [
    {"id": "opt1", "content": "第一步"},
    {"id": "opt2", "content": "第二步"},
    {"id": "opt3", "content": "第三步"}
  ],
  "correct_options": ["opt1", "opt2", "opt3"]
}
```

#### G. 综合大题 (big)

- **content**: 大题的背景材料。

- **children**: 子题目数组，每个子题目结构同上（不支持嵌套大题）。

codeJSON

```
{
  "type": "big",
  "content": "阅读以下材料并回答问题：[材料内容...]",
  "children": [
    {
      "type": "single",
      "content": "1. 根据材料，文中提到的年份是？",
      "options": [...],
      "correct_options": [...]
    },
    {
      "type": "fill",
      "content": "2. 文中的核心观点是 {point}。",
      "correct_options": {"point": ["..."]}
    }
  ]
}
```

---

### 3. 注意事项

1. **唯一性**: 在同一道填空题中，单花括号 {} 的键名不能重复。

2. **双花括号**: {{key}} 专门用于“答案集合相同且不可重复填入”的场景。

3. **JSON 字符串**: 如果通过数据库导入，options 和 correct_options 字段通常需要存储为 JSON 字符串，但在导入界面的 JSON 编辑器中，你可以直接编写对象/数组。

4. **转义**: 如果题干中包含引号，请注意在 JSON 字符串中进行转义（如 \"）。
