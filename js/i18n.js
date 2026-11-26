'use strict';
/* Day Deck languages. Chinese is the default and the source text: every UI string is written in Chinese
   and passed through DD.t(), which returns the English entry when English is on.
   Things the user typed (food names, notes, custom chips, renamed cards) are never translated.
   The choice is remembered per device, like the expense app. */
(function () {
  const DD = (window.DD = window.DD || {});
  const LANG_KEY = 'daydeck.lang';
  let lang = 'zh';
  try { if (localStorage.getItem(LANG_KEY) === 'en') lang = 'en'; } catch (e) {}

  DD.lang = () => lang;
  DD.setLang = (l) => {
    lang = l === 'en' ? 'en' : 'zh';
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');
  };
  document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');

  const s = (n) => (Number(n) === 1 ? '' : 's');

  // English text for each Chinese source string. A function gets the variables (for plurals).
  const EN = {
    // Pages and header
    '记录': 'Log', '洞察': 'Insights', '小结': 'Highlights', '今天': 'Today', '设置': 'Settings',
    '切换到日间': 'Switch to day', '切换到夜间': 'Switch to night', '切换到英文': 'Switch to English', '切换到中文': 'Switch to Chinese',
    '选择日期': 'Pick a date', '← 回到今天': '← Back to today', '卡牌': 'Cards', '展开卡牌': 'Show cards',
    '{n} 条 · {day}': (v) => `${v.n} entr${Number(v.n) === 1 ? 'y' : 'ies'} · ${v.day}`,
    '全部': 'All', '饮食': 'Food', '做事': 'Do', '工作': 'Work',
    '这个分类是空的，切到「全部」看看': 'Nothing in this filter yet. Try “All”.',
    '从下面抽一张卡，记下第一件事': 'Draw a card below to log the first thing.',
    '这一天是空白的，可以补记': 'This day is blank. You can fill it in.',
    '进行中': 'Running', '{time} 开始': (v) => `started ${v.time}`,

    // Cards
    '吃饭': 'Eat', '健身': 'Gym', '家务': 'Home', '更多': 'More',
    '{when} 记录': (v) => `Last ${v.when}`,
    '本月': 'Month', '本周': 'Week', '今天学到': 'Learned today', '今天做了': 'Done today',
    '餐': (v) => `meal${s(v.n)}`, '次': (v) => `time${s(v.n)}`, '件': (v) => `thing${s(v.n)}`, '条': (v) => `item${s(v.n)}`,
    '小时': 'h', '分钟': 'min',
    '记下吃了什么': 'Log what you ate', '本周 {n} 种食物': (v) => `${v.n} food${s(v.n)} this week`,
    '练了什么、几组': 'Exercises and sets', '上次 {what}': (v) => `Last: ${v.what}`,
    '探索、写作、社交': 'Explore, write, social', '收拾、洗衣服、做饭': 'Tidy, laundry, cook',
    '今天 {what}': (v) => `Today: ${v.what}`, '学到了什么、复盘': 'Learned, review', '复盘写好了': 'Review written',
    '花销、看了什么、读了什么': 'Spending, watched, read',

    // Sheets: common
    '取消': 'Cancel', '保存': 'Save', '完成': 'Done', '添加': 'Add', '备注': 'Note', '可选': 'Optional',
    '时间': 'Time', '开始时间': 'Start time', '多久': 'How long', '15 分钟': '15 min', '30 分钟': '30 min', '1 小时': '1 h', '1.5 小时': '1.5 h',
    '一句话就好': 'One line is enough', '删除这条记录': 'Delete this entry', '删除这条记录？': 'Delete this entry?', '删掉了': 'Deleted',
    '记下了': 'Logged', '改好了': 'Updated', '移除': 'Remove',
    '{time} 开始 · 计时中': (v) => `Started ${v.time} · timing`, '放弃': 'Discard', '停止': 'Stop', '放弃这次计时？不会保存记录。': 'Discard this timer? Nothing will be saved.',
    '计时结束': 'Timer stopped', '确认后点保存': 'Check, then Save', '现在开始做？先开始计时，做完再回来补充。': 'Starting now? Start the timer and fill in the rest when you’re done.',
    '开始计时': 'Start timer', '开始计时了，做完点卡片结束': 'Timer started. Tap the card when you’re done.',
    '「{name}」正在计时。先把它结束并保存，再开始新的？': (v) => `“${v.name}” is still timing. Finish and save it, then start the new one?`,

    // Meal
    '早餐': 'Breakfast', '午餐': 'Lunch', '晚餐': 'Dinner', '加餐': 'Snack',
    '吃了什么': 'What did you eat', '例如：鸡蛋': 'e.g. eggs', '选一个分类（以后会记住）': 'Pick a group (remembered next time)',
    '蛋白质': 'Protein', '蔬菜': 'Vegetables', '水果': 'Fruit', '主食': 'Grains', '奶豆': 'Dairy & soy', '坚果种子': 'Nuts & seeds', '其他': 'Other',
    '小份': 'Small', '中份': 'Medium', '大份': 'Large', '加一样吃的': 'Add something you ate',

    // Gym
    '照上次练（{when}）': (v) => `Repeat last session (${v.when})`, '练哪里': 'Focus',
    '推': 'Push', '拉': 'Pull', '腿': 'Legs', '全身': 'Full body', '有氧': 'Cardio',
    '动作': 'Exercises', '例如：深蹲': 'e.g. squat', '移除动作': 'Remove exercise', '第{n}组': (v) => `Set ${v.n}`, '次数': 'Reps', '删除这组': 'Delete set',
    '+ 一组': '+ Set', '{n} 组': (v) => `${v.n} set${s(v.n)}`, '加一个动作，或者填一下多久': 'Add an exercise, or how long you trained',

    // Doing
    '做了什么': 'What did you do', '探索': 'Explore', '写作': 'Writing', '社交': 'Social', '取悦自己': 'Just for me', '生活 admin': 'Life admin',
    '发现了什么？': 'What did you find?', '推进了什么？': 'What moved forward?', '和谁？下一步？': 'Who with? Next step?', '做了什么？': 'What did you do?', '处理了什么？': 'What did you sort out?',
    '哪个项目': 'Which project', '新项目名': 'New project name', '项目': 'Project', '和谁': 'With', '朋友': 'Friends', '工作与职业': 'Work & career',
    '值得吗？': 'Worth it?', '值得': 'Worth it', '不太值': 'Not really',

    // Home (家务)
    '收拾': 'Tidy', '洗衣服': 'Laundry', '做饭': 'Cook', '清洁': 'Clean', '采购': 'Shopping',
    '做了哪些（可多选）': 'What did you do (pick any)', '自己加一项': 'Add your own', '选一项家务': 'Pick at least one',
    '做了饭，顺便记一下吃了什么？': 'You cooked. Log what you ate?', '记一餐': 'Log a meal',

    // Work
    '学习 / 做了什么': 'Learned / Did', '复盘': 'Review', '类型': 'Type', '学到': 'Learned', '做了': 'Did', '学到了什么？': 'What did you learn?',
    '{day}记下的': (v) => `Noted ${v.day}`, '工作和工作以外的都可以写，每项都可以空着。': 'Work and life both count. Any field can stay empty.',
    '今天做了什么': 'What I did today', '学到了什么': 'What I learned', '一行一条': 'One per line', '明天要做什么': 'What’s next tomorrow',
    '写一句做了什么': 'Write a line about what you did', '写一句学到了什么': 'Write a line about what you learned', '至少写一项': 'Fill in at least one',

    // More
    '花销': 'Spending', '看了 / 读了': 'Watched / Read', '自由记录': 'Free note', '多少钱': 'Amount', '花在哪': 'On what',
    '一句话（只是随手记，不做预算）': 'One line (a quick note, no budgets)', '什么': 'What kind', '名字': 'Title', '书名、剧名、展名…': 'Book, show, exhibition…',
    '书': 'Book', '剧': 'Series', '电影': 'Film', '播客': 'Podcast', '展': 'Exhibition', '游戏': 'Game',
    '读完了吗？': 'Finished?', '看完了吗？': 'Finished?', '读完了': 'Finished', '看完了': 'Finished', '在读': 'Reading', '在看': 'Watching',
    '读了': 'Read', '听了': 'Listened', '玩了': 'Played', '看了': 'Watched',
    '想法': 'Thoughts', '写点什么': 'Write something', '随便写': 'Anything', '填一下金额': 'Enter an amount', '填一下名字': 'Enter a title', '写一点内容': 'Write something first',

    // Notes
    '这个月去了 {n} 次健身房': (v) => `Went to the gym ${v.n} time${s(v.n)} this month`,
    '{ex} 比上个月多了 {kg} kg': (v) => `${v.ex} is up ${v.kg} kg on last month`,
    '本周吃到了 {n} 种食物': (v) => `Ate ${v.n} different food${s(v.n)} this week`,
    '，可以多加几种{group}': (v) => `; could add a few more ${String(v.group).toLowerCase()}`,
    '这个月已经吃了 {n} 种蛋白质': (v) => `${v.n} kinds of protein this month`,
    '，可以增加一些蔬菜的种类': '; could add a few more kinds of vegetables',
    '本周写作 {dur}': (v) => `Wrote for ${v.dur} this week`, '本周写作了 {n} 次': (v) => `Wrote ${v.n} time${s(v.n)} this week`,
    '，{p}推进了 {n} 次': (v) => `; ${v.p} moved forward ${v.n} time${s(v.n)}`,
    '本周探索了 {dur}': (v) => `Explored for ${v.dur} this week`, '本周探索了 {n} 次': (v) => `Explored ${v.n} time${s(v.n)} this week`,
    '这周已经做了 {n} 次家务': (v) => `Did housework ${v.n} time${s(v.n)} this week`,
    '本周记下了 {n} 条学到的东西': (v) => `Noted ${v.n} thing${s(v.n)} learned this week`,
    '这个月去看了 {n} 次展': (v) => `Saw ${v.n} exhibition${s(v.n)} this month`,
    '这个月为自己安排了 {n} 件开心的事': (v) => `Did ${v.n} thing${s(v.n)} just for you this month`,
    '这个月读完了 {n} 本书': (v) => `Finished ${v.n} book${s(v.n)} this month`,
    '今天记下了 {n} 件事': (v) => `Logged ${v.n} thing${s(v.n)} today`,
    '抽一张卡，记下今天的第一件事': 'Draw a card and log the first thing today',

    // Insights
    '每天记了几条': 'Entries per day', '最近 7 天共 {n} 条': (v) => `${v.n} in the last 7 days`, '本月共 {n} 条': (v) => `${v.n} this month`,
    '食物图鉴': 'Food collection', '{p} {n} 种': (v) => `${v.p}: ${v.n} food${s(v.n)}`, '{n} 种': (v) => `${v.n}`,
    '记一餐，吃到的食物会收集在这里': 'Log a meal and the foods you eat collect here',
    '时间去哪了': 'Where the time went', '{p}共 {dur}': (v) => `${v.p}: ${v.dur} in total`,
    '记下时长或用计时，这里会显示时间分布': 'Log durations or use the timer to see where time goes',
    '{p} {n} 次': (v) => `${v.p}: ${v.n}`, '每次训练的最大重量（kg）': 'Top weight per session (kg)',
    '记录动作和重量后，这里会画出变化': 'Log exercises with weights to see progress here',
    '学到的 / 复盘': 'Learned / Review', '工作卡里的「学到」、复盘、探索的发现会汇总在这里': 'What you learned, reviews and exploring notes collect here',
    '在「更多」里记下看过、读过的': 'Log what you watch and read under “More”',
    '每天记录数': 'Entries per day', '最大重量变化': 'Top weight over time',

    // Settings
    '外观': 'Appearance', '跟随系统': 'System', '日间': 'Day', '夜间': 'Night', '语言': 'Language', '中文': '中文', 'English': 'English',
    '一天从几点开始': 'Day starts at', '这个时间之前的记录算前一天': 'Entries before this count as the day before',
    '卡片（改名、排序）': 'Cards (rename, reorder)', '卡片名称': 'Card name', '上移': 'Move up', '下移': 'Move down',
    '做事的类型': 'Doing types', '亮着的会出现在「做事」卡里。': 'Highlighted ones appear in the Doing card.', '至少留一个': 'Keep at least one',
    '家务选项': 'Home options', '在家务卡里可以直接加新的选项。': 'You can add new options right in the Home card.',
    '从选项里去掉「{c}」？以前的记录不受影响。': (v) => `Remove “${v.c}” from the options? Past entries stay as they are.`,
    '更多里的类型': 'Types under More', '食物分类': 'Food groups', '{n} 的分类': (v) => `Group for ${v.n}`,
    '记过的食物会出现在这里，可以改分类。': 'Foods you log appear here, and you can change their group.',
    '动作名称': 'Exercise name', '合并到': 'Merge into', '合并到…': 'Merge into…',
    '把「{a}」的记录都合并到「{b}」？': (v) => `Merge all “${v.a}” entries into “${v.b}”?`,
    '记过的健身动作会出现在这里，可以改名或合并重复的。': 'Exercises you log appear here, to rename or merge duplicates.',
    '数据': 'Data', '现在有 {n} 条记录，只存在这台设备的这个浏览器里。': (v) => `${v.n} entr${Number(v.n) === 1 ? 'y' : 'ies'}, stored only in this browser on this device.`,
    '导出全部数据（JSON）': 'Export all data (JSON)', '导入 JSON…': 'Import JSON…', '删除全部数据': 'Delete all data',
    '现在没有数据': 'There’s no data yet', '删除全部记录、食物和动作？建议先导出一份。': 'Delete all entries, foods and exercises? Export a copy first.',
    '再确认一次：删除后不能恢复。': 'Are you sure? This can’t be undone.', '已清空': 'Cleared',
    '关于': 'About', '名称': 'Name', '（暂名）': ' (working name)', '版本': 'Version', '数据格式': 'Data format',
    '已导出 {name}': (v) => `Exported ${v.name}`, '这个文件不是有效的 JSON': 'This file isn’t valid JSON', '不能导入：': 'Can’t import:',
    '文件里有 {n} 条记录（{a} 到 {b}）': (v) => `The file has ${v.n} entr${Number(v.n) === 1 ? 'y' : 'ies'} (${v.a} to ${v.b})`,
    '文件里没有记录': 'The file has no entries', '{summary}。\n用它替换现在的 {n} 条记录？': (v) => `${v.summary}.\nReplace the current ${v.n} entr${Number(v.n) === 1 ? 'y' : 'ies'} with it?`,
    '导入好了': 'Imported',
    '保存失败：浏览器存储可能满了或被禁用': 'Couldn’t save: browser storage may be full or turned off',
    '不是一个数据对象': 'Not a data object', 'schemaVersion 应为 {a}，文件里是 {b}': 'schemaVersion should be {a}; the file has {b}',
    '缺少 records 列表': 'The records list is missing', '第 {n} 条记录格式不对': 'Entry {n} has the wrong shape',
    '第 {n} 条记录的 id 缺失或重复': 'Entry {n} has a missing or repeated id', '第 {n} 条记录的卡片类型未知：{c}': 'Entry {n} has an unknown card: {c}',
    '第 {n} 条记录的时间读不出来': 'Entry {n} has an unreadable time',
    '这个浏览器现在不能保存数据（可能是无痕模式）。记录在关闭页面后会丢失。': 'This browser can’t save data right now (private browsing?). Entries will be lost when the page closes.',
    '保存的数据读不出来，原样备份在 {k}。现在从空白开始。': 'The saved data couldn’t be read. It was kept as-is under {k}; starting blank.',
    '保存的数据读不出来，也没法备份。为了不覆盖它，这次的改动不会保存。': 'The saved data couldn’t be read or backed up. To protect it, changes this time won’t be saved.',
  };
  DD.EN = EN;

  // t('今天 {n} 餐', {n: 2}) -> "今天 2 餐" or the English entry.
  DD.t = function (key, vars) {
    let out = lang === 'en' && EN[key] != null ? EN[key] : key;
    if (typeof out === 'function') out = out(vars || {});
    if (vars) out = String(out).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return out;
  };
})();
