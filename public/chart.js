function renderChart(historyData) {
    const canvas = document.getElementById('trendChart');
    const ctx = canvas.getContext('2d');
    // 设置高分屏模糊处理
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // 清空
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 模拟数据映射 (状态:很好=4, 还行=3, 有点累=2, 需要联系=1)
    const mapStatus = { '很好': 4, '还行': 3, '有点累': 2, '需要联系': 1 };
    
    // 简化：直接绘制点
    const padding = 30;
    const graphHeight = rect.height - padding * 2;
    const stepX = (rect.width - padding * 2) / 6;

    // 简单的趋势线
    ctx.beginPath();
    ctx.strokeStyle = '#ff7e5f';
    ctx.lineWidth = 3;
    
    // 倒序绘制最近7天
    // 注意：historyData 是按日期倒序的 (今天在最前)
    // 这里为了演示简单，只画点
    historyData.forEach((item, index) => {
        const x = padding + index * stepX;
        const val = mapStatus[item.status] || 0;
        // 归一化高度 (0-4 -> height-0)
        const y = rect.height - padding - (val / 4) * graphHeight;

        // 画点
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 文字
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(item.status.substring(0,1), x, rect.height - 10);
    });
}
