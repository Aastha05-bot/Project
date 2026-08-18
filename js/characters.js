/* =========================================================
   CHARACTER REGISTRY
========================================================= */
const CHAR_INFO = {
    maya: { name: 'Maya', cssClass: 'avatar-maya' },
    aarav: { name: 'Aarav', cssClass: 'avatar-aarav' },
    sita: { name: 'Sita', cssClass: 'avatar-sita' }
};

function avatarHTML(key) {
    const c = CHAR_INFO[key];
    if (!c) return '';
    return `<div class="avatar ${c.cssClass}" title="${c.name}"></div>`;
}
