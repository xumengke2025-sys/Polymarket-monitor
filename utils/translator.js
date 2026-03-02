
// 简单的关键词翻译映射表
const TAG_MAP = {
    "politics": "政治",
    "crypto": "加密货币",
    "business": "商业",
    "science": "科学",
    "sports": "体育",
    "pop culture": "流行文化",
    "global elections": "全球选举",
    "middle east": "中东局势",
    "us election": "美国大选",
    "economics": "经济",
    "technology": "科技",
    "ai": "人工智能",
    "bitcoin": "比特币",
    "ethereum": "以太坊",
    "nfl": "NFL橄榄球",
    "nba": "NBA篮球",
    "soccer": "足球",
    "tennis": "网球",
    "climate change": "气候变化"
};

const TITLE_KEYWORDS = {
    "Will": "是否",
    "will": "是否",
    "by": "在",
    "before": "之前",
    "after": "之后",
    "in": "在",
    "at": "在",
    "reach": "达到",
    "hit": "达到",
    "approve": "批准",
    "launch": "发布",
    "win": "赢得",
    "lose": "输掉",
    "election": "选举",
    "presidential": "总统",
    "nominee": "提名人",
    "Bitcoin": "比特币",
    "Ethereum": "以太坊",
    "ETF": "ETF基金",
    "Trump": "特朗普",
    "Biden": "拜登",
    "Harris": "哈里斯",
    "Musk": "马斯克",
    "Fed": "美联储",
    "interest rate": "利率",
    "cut": "降息",
    "hike": "加息",
    "price": "价格",
    "above": "高于",
    "below": "低于",
    "market cap": "市值",
    "approval": "支持率",
    "poll": "民调",
    "debate": "辩论",
    "war": "战争",
    "ceasefire": "停火",
    "IPO": "IPO上市",
    "recession": "经济衰退",
    "inflation": "通胀",
    "CPI": "CPI指数",
    "GDP": "GDP",
    "China": "中国",
    "US": "美国",
    "Russia": "俄罗斯",
    "Ukraine": "乌克兰",
    "Israel": "以色列",
    "Gaza": "加沙",
    "Taiwan": "台湾",
    "Japan": "日本",
    "India": "印度",
    "UK": "英国",
    "EU": "欧盟",
    "SpaceX": "SpaceX",
    "Tesla": "特斯拉",
    "Nvidia": "英伟达",
    "Apple": "苹果",
    "Microsoft": "微软",
    "Google": "谷歌",
    "Amazon": "亚马逊",
    "Meta": "Meta",
    "OpenAI": "OpenAI",
    "GPT-5": "GPT-5",
    "Sora": "Sora",
    "released": "发布",
    "announced": "宣布",
    "confirmed": "确认",
    "banned": "被禁",
    "arrested": "被捕",
    "resigns": "辞职",
    "fired": "被解雇",
    "convicted": "被定罪",
    "jail": "入狱",
    "prison": "监狱",
    "sentence": "判决",
    "guilty": "有罪",
    "innocent": "无罪",
    "record high": "历史新高",
    "all time high": "历史新高",
    "ATH": "历史新高",
    "100k": "10万美元",
    "active": "活跃",
    "users": "用户",
    "subscribers": "订阅者",
    "followers": "粉丝",
    "views": "观看量",
    "grossing": "票房",
    "movie": "电影",
    "song": "歌曲",
    "album": "专辑",
    "award": "奖项",
    "Oscar": "奥斯卡",
    "Grammy": "格莱美",
    "Nobel": "诺贝尔奖",
    "Super Bowl": "超级碗",
    "World Cup": "世界杯",
    "Olympics": "奥运会",
    "Gold": "金牌",
    "Medal": "奖牌",
    "Champion": "冠军",
    "MVP": "MVP",
    "Rookie": "新秀",
    "Coach": "教练",
    "Player": "球员",
    "Team": "球队",
    "League": "联赛",
    "Season": "赛季",
    "Game": "比赛",
    "Match": "比赛",
    "Tournament": "锦标赛",
    "Round": "轮次",
    "Final": "决赛",
    "Quarter": "季度",
    "Month": "月",
    "Year": "年",
    "Day": "天",
    "Week": "周",
    "Today": "今天",
    "Tomorrow": "明天",
    "Yesterday": "昨天",
    "Next": "下一个",
    "Last": "上一个",
    "First": "第一个",
    "Second": "第二个",
    "Third": "第三个",
    "Top": "前",
    "Bottom": "后",
    "Best": "最佳",
    "Worst": "最差",
    "Highest": "最高",
    "Lowest": "最低",
    "Most": "最多",
    "Least": "最少",
    "More": "更多",
    "Less": "更少",
    "Over": "超过",
    "Under": "低于",
    "Between": "之间",
    "Of": "的",
    "And": "和",
    "Or": "或",
    "Not": "不",
    "Is": "是",
    "Are": "是",
    "Was": "是",
    "Were": "是",
    "Be": "是",
    "Have": "有",
    "Has": "有",
    "Had": "有",
    "Do": "做",
    "Does": "做",
    "Did": "做",
    "Can": "能",
    "Could": "能",
    "May": "可能",
    "Might": "可能",
    "Must": "必须",
    "Should": "应该",
    "Would": "会",
    "How many": "多少",
    "How much": "多少",
    "Who": "谁",
    "What": "什么",
    "Where": "哪里",
    "When": "什么时候",
    "Why": "为什么",
    "Which": "哪个"
};

function translateText(text) {
    if (!text) return text;
    let translated = text;
    
    // 简单的全字匹配替换，按长度降序排序，优先替换长词组
    const sortedKeys = Object.keys(TITLE_KEYWORDS).sort((a, b) => b.length - a.length);
    
    for (const key of sortedKeys) {
        // 使用正则替换，忽略大小写，且匹配单词边界（对于部分短词很重要，避免部分匹配）
        // 但对于中文来说，没有单词边界，所以对于长词组直接替换，短词需要小心
        // 这里简化处理：直接替换，不强求完美语法
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        translated = translated.replace(regex, TITLE_KEYWORDS[key]);
    }
    return translated;
}

function categorizeEvent(event) {
    if (!event.tags || event.tags.length === 0) {
        return "其他";
    }

    // 优先匹配映射表中的 Tag
    for (const tag of event.tags) {
        const lowerSlug = (tag.slug || "").toLowerCase();
        const lowerLabel = (tag.label || "").toLowerCase();
        
        if (TAG_MAP[lowerSlug]) return TAG_MAP[lowerSlug];
        if (TAG_MAP[lowerLabel]) return TAG_MAP[lowerLabel];
        
        // 尝试部分匹配
        for (const key in TAG_MAP) {
            if (lowerSlug.includes(key) || lowerLabel.includes(key)) {
                return TAG_MAP[key];
            }
        }
    }

    // 如果没有匹配到，默认返回第一个 Tag 的 Label，如果 Label 也没有，就返回 "其他"
    return event.tags[0].label || "其他";
}

module.exports = {
    translateText,
    categorizeEvent
};
