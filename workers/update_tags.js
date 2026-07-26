const fs = require('fs');

let rawData;
try {
    rawData = fs.readFileSync('dump.json', 'utf16le');
} catch (e) {
    rawData = fs.readFileSync('dump.json', 'utf8');
}

if (rawData.charCodeAt(0) === 0xFEFF || rawData.charCodeAt(0) === 0xFFFE) {
    rawData = rawData.slice(1);
}

let data = [];
try {
    const parsed = JSON.parse(rawData);
    if (Array.isArray(parsed)) {
        for (const item of parsed) {
            if (item.results && Array.isArray(item.results)) {
                data.push(...item.results);
            }
        }
    } else if (parsed.results) {
        data.push(...parsed.results);
    }
} catch (e) {
    console.error('Lỗi parse JSON:', e.message);
    process.exit(1);
}

const sqlStatements = [];
const TOAN_KEYWORDS = ['toán', '#toan', 'phép tính', 'phân số', 'hình học', 'phép nhân', 'phép chia', 'phép cộng', 'phép trừ', 'biểu thức', 'quy đồng', 'rút gọn', 'so sánh phân số', 'làm tròn số', 'hình bình hành', 'đề xi mét', 'mili mét', 'ki lô mét'];
const TIENG_VIET_KEYWORDS = ['tiếng việt', '#tieng_viet', 'chủ ngữ', 'vị ngữ', 'trạng nguyên', 'luyện từ và câu', 'từ đơn', 'từ phức', 'ngữ pháp', 'gia đình', 'tập đọc', 'chính tả', 'từ láy', 'từ ghép', 'biện pháp tu từ', 'nhân hóa', 'so sánh', 'danh từ', 'động từ', 'tính từ'];
const TIENG_ANH_KEYWORDS = ['tiếng anh', '#tieng_anh', 'english', 'vocabulary', 'grammar', 'choose the correct'];
const KHOA_HOC_KEYWORDS = ['khoa học', '#khoa_hoc', 'tự nhiên và xã hội', 'lịch sử', 'địa lý', 'không khí', 'nước', 'động vật', 'thực vật', 'vật lý', 'hóa học'];
const TIN_HOC_KEYWORDS = ['tin học', '#tin_hoc', 'máy tính', 'lập trình', 'scratch', 'chuột', 'bàn phím', 'logo', 'rùa'];

function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a").replace(/[èéẹẻẽêềếệểễ]/g, "e").replace(/[ìíịỉĩ]/g, "i").replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o").replace(/[ùúụủũưừứựửữ]/g, "u").replace(/[ỳýỵỷỹ]/g, "y").replace(/đ/g, "d");
}

function cleanTag(tag) {
    let t = tag.trim();
    if (t.startsWith('#')) t = t.substring(1);
    t = normalizeString(t).replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    t = t.replace(/^_|_$/g, '');
    return '#' + t;
}

const tagMapping = {
    '#toan': '#toan',
    '#toan_hoc': '#toan',
    '#tieng_viet': '#tieng_viet',
    '#khoa_hoc': '#khoa_hoc',
    '#tu_nhien_xa_hoi': '#khoa_hoc',
    '#tieng_anh': '#tieng_anh',
    '#tin_hoc': '#tin_hoc'
};

for (const q of data) {
    const content = ((q.question || '') + ' ' + (q.items || '') + ' ' + (q.text_field || '') + ' ' + (q.sentence || '') + ' ' + (q.title || '')).toLowerCase();

    let currentTags = [];
    if (q.tags && q.tags !== '[]') {
        if (q.tags.startsWith('[')) {
            try {
                currentTags = JSON.parse(q.tags);
            } catch (e) {
                currentTags = q.tags.replace(/[\[\]"]/g, '').split(',').map(t => t.trim());
            }
        } else {
            currentTags = q.tags.split(',').map(t => t.trim());
        }
    }

    let cleanedTags = currentTags.filter(t => t).map(cleanTag);
    cleanedTags = cleanedTags.filter(t => t !== '#' && t !== '#_');

    const hasMainTag = cleanedTags.some(t => ['#toan', '#tieng_viet', '#khoa_hoc', '#tieng_anh', '#tin_hoc', '#tu_nhien_xa_hoi'].includes(t));

    if (!hasMainTag) {
        if (TOAN_KEYWORDS.some(k => content.includes(k.toLowerCase()))) {
            cleanedTags.unshift('#toan');
        } else if (TIENG_VIET_KEYWORDS.some(k => content.includes(k.toLowerCase()))) {
            cleanedTags.unshift('#tieng_viet');
        } else if (KHOA_HOC_KEYWORDS.some(k => content.includes(k.toLowerCase()))) {
            cleanedTags.unshift('#khoa_hoc');
        } else if (TIENG_ANH_KEYWORDS.some(k => content.includes(k.toLowerCase()))) {
            cleanedTags.unshift('#tieng_anh');
        } else if (TIN_HOC_KEYWORDS.some(k => content.includes(k.toLowerCase()))) {
            cleanedTags.unshift('#tin_hoc');
        } else if (q.category === 'trang-nguyen') {
            cleanedTags.unshift('#tieng_viet');
            if (!cleanedTags.includes('#trang_nguyen')) cleanedTags.push('#trang_nguyen');
        }
    } else {
        cleanedTags = cleanedTags.map(t => tagMapping[t] || t);
    }

    if (content.includes('phân số') && !cleanedTags.includes('#phan_so')) cleanedTags.push('#phan_so');
    if (content.includes('chủ ngữ') && !cleanedTags.includes('#chu_ngu')) cleanedTags.push('#chu_ngu');
    if (content.includes('vị ngữ') && !cleanedTags.includes('#vi_ngu')) cleanedTags.push('#vi_ngu');
    if (content.includes('làm tròn') && !cleanedTags.includes('#lam_tron')) cleanedTags.push('#lam_tron');
    if (content.includes('rút gọn') && !cleanedTags.includes('#rut_gon')) cleanedTags.push('#rut_gon');
    if (content.includes('danh từ') && !cleanedTags.includes('#danh_tu')) cleanedTags.push('#danh_tu');

    // Force lowercase, sort for consistency
    cleanedTags = [...new Set(cleanedTags)].sort();
    const newTagsStr = cleanedTags.join(',');

    const oldTagsSorted = [...new Set(currentTags.filter(t => t && t !== '[]').map(t => t.trim()))].sort().join(',');

    if (newTagsStr !== oldTagsSorted || true) { // Force update to standardize 
        const escapedTagsStr = newTagsStr.replace(/'/g, "''");
        sqlStatements.push(`UPDATE questions SET tags = '${escapedTagsStr}' WHERE id = '${q.id}';`);
    }
}

const chunkSize = 100;
let fileCount = 0;
for (let i = 0; i < sqlStatements.length; i += chunkSize) {
    const chunk = sqlStatements.slice(i, i + chunkSize);
    fs.writeFileSync(`update_tags_${fileCount}.sql`, chunk.join('\n'), 'utf8');
    fileCount++;
}

fs.writeFileSync('update_tags_all.sql', sqlStatements.join('\n'), 'utf8');
console.log(`Generated ${sqlStatements.length} update queries across ${fileCount} files.`);
