document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('source-code-list');
    const loading = document.getElementById('loading');

    fetch('/api/source-code')
        .then(res => res.json())
        .then(data => {
            loading.style.display = 'none';
            if (!data.success) {
                container.innerHTML = `<div class="error">Error: ${data.error}</div>`;
                return;
            }

            data.files.forEach(file => {
                const section = document.createElement('div');
                section.className = 'code-section';

                section.innerHTML = `
                    <div class="code-header">
                        <div class="file-path">${file.path}</div>
                        <div class="file-lang">${file.language}</div>
                    </div>
                    <div class="code-body">
                        <pre class="line-numbers"><code class="language-${file.language}">${escapeHtml(file.content)}</code></pre>
                    </div>
                `;
                container.appendChild(section);
            });

            // Re-highlight semua kode setelah di-render
            Prism.highlightAll();
        })
        .catch(err => {
            loading.innerText = 'Gagal memuat data.';
            console.error(err);
        });
});

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}