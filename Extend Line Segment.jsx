#target illustrator

function extendCurvedPathFromSelectedPoint() {
    // بررسی وجود سند باز و انتخاب
    if (app.documents.length == 0) {
        alert("لطفاً یک سند باز کنید.");
        return;
    }
    if (app.activeDocument.selection.length != 1) {
        alert("لطفاً دقیقاً یک مسیر با دو نقطه انتخاب کنید.");
        return;
    }

    var doc = app.activeDocument;
    var sel = doc.selection[0];

    // بررسی اینکه آیا انتخاب یک مسیر با دو نقطه است
    if (!(sel.typename == "PathItem" && sel.pathPoints.length == 2)) {
        alert("لطفاً یک مسیر با دو نقطه انتخاب کنید.");
        return;
    }

    var path = sel;
    var point1 = path.pathPoints[0];
    var point2 = path.pathPoints[1];

    // بررسی نقطه انتخاب‌شده
    var selectedPointIndex = -1;
    if (point1.selected == PathPointSelection.ANCHORPOINT) {
        selectedPointIndex = 0;
    } else if (point2.selected == PathPointSelection.ANCHORPOINT) {
        selectedPointIndex = 1;
    } else {
        alert("لطفاً یکی از نقاط انتهایی مسیر را انتخاب کنید.");
        return;
    }

    // تابع محاسبه طول قوس منحنی بزیه
    function calculateBezierLength(p0, p1, p2, p3) {
        var steps = 100; // تعداد نقاط نمونه
        var totalLength = 0;
        var prevPoint = null;

        for (var t = 0; t <= 1; t += 1 / steps) {
            var t2 = t * t;
            var t3 = t2 * t;
            var mt = 1 - t;
            var mt2 = mt * mt;
            var mt3 = mt2 * mt;

            var x = mt3 * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t3 * p3[0];
            var y = mt3 * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t3 * p3[1];

            var currentPoint = [x, y];
            if (prevPoint) {
                var dx = currentPoint[0] - prevPoint[0];
                var dy = currentPoint[1] - prevPoint[1];
                totalLength += Math.sqrt(dx * dx + dy * dy);
            }
            prevPoint = currentPoint;
        }
        return totalLength;
    }

    // استخراج نقاط و دسته‌های کنترلی مسیر اصلی
    var p0 = point1.anchor; // نقطه شروع
    var p1 = point1.rightDirection; // دسته کنترلی خروجی نقطه شروع
    var p2 = point2.leftDirection; // دسته کنترلی ورودی نقطه پایان
    var p3 = point2.anchor; // نقطه پایان

    // محاسبه طول قوس مسیر اصلی
    var pathLength = calculateBezierLength(p0, p1, p2, p3);
    var targetExtendLength = pathLength / 3;

    // نقاط و دسته‌های کنترلی برای امتداد
    var startPoint, newPoint, newControl1, newControl2;

    if (selectedPointIndex == 0) {
        // امتداد از نقطه اول (p0) با استفاده از rightDirection
        startPoint = p0;
        var directionX = p1[0] - p0[0]; // جهت rightDirection
        var directionY = p1[1] - p0[1];
        var directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        if (directionLength == 0) {
            // اگر دسته کنترلی صفر باشد، از جهت خط به سمت p3 استفاده می‌کنیم
            directionX = p3[0] - p0[0];
            directionY = p3[1] - p0[1];
            directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        }
        directionX /= directionLength;
        directionY /= directionLength;

        // نقاط اولیه برای امتداد
        newPoint = [
            p0[0] + directionX * targetExtendLength,
            p0[1] + directionY * targetExtendLength
        ];
        newControl1 = [
            p0[0] + (p1[0] - p0[0]) * 0.5, // دسته کنترلی برای پیوستگی
            p0[1] + (p1[1] - p0[1]) * 0.5
        ];
        newControl2 = [
            p0[0] + directionX * targetExtendLength * 0.5,
            p0[1] + directionY * targetExtendLength * 0.5
        ];
    } else {
        // امتداد از نقطه دوم (p3) با استفاده از leftDirection
        startPoint = p3;
        var directionX = p2[0] - p3[0]; // جهت leftDirection
        var directionY = p2[1] - p3[1];
        var directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        if (directionLength == 0) {
            // اگر دسته کنترلی صفر باشد، از جهت خط به سمت p0 استفاده می‌کنیم
            directionX = p0[0] - p3[0];
            directionY = p0[1] - p3[1];
            directionLength = Math.sqrt(directionX * directionX + directionY * directionY);
        }
        directionX /= directionLength;
        directionY /= directionLength;

        // نقاط اولیه برای امتداد
        newPoint = [
            p3[0] + directionX * targetExtendLength,
            p3[1] + directionY * targetExtendLength
        ];
        newControl1 = [
            p3[0] + (p2[0] - p3[0]) * 0.5, // دسته کنترلی برای پیوستگی
            p3[1] + (p2[1] - p3[1]) * 0.5
        ];
        newControl2 = [
            p3[0] + directionX * targetExtendLength * 0.5,
            p3[1] + directionY * targetExtendLength * 0.5
        ];
    }

    // تنظیم طول قوس امتداد
    var scale = 1;
    var currentLength = calculateBezierLength(startPoint, newControl1, newControl2, newPoint);
    var tolerance = 0.01;
    var maxIterations = 50;
    var iteration = 0;

    while (Math.abs(currentLength - targetExtendLength) > tolerance && iteration < maxIterations) {
        scale *= targetExtendLength / currentLength;
        newPoint = [
            startPoint[0] + (newPoint[0] - startPoint[0]) * scale,
            startPoint[1] + (newPoint[1] - startPoint[1]) * scale
        ];
        newControl2 = [
            startPoint[0] + (newControl2[0] - startPoint[0]) * scale,
            startPoint[1] + (newControl2[1] - startPoint[1]) * scale
        ];
        currentLength = calculateBezierLength(startPoint, newControl1, newControl2, newPoint);
        iteration++;
    }

    // اصلاح مسیر اصلی برای اتصال امتداد
    if (selectedPointIndex == 0) {
        // اضافه کردن نقطه جدید به ابتدای مسیر
        var newStartPoint = path.pathPoints.add();
        newStartPoint.anchor = newPoint;
        newStartPoint.rightDirection = newPoint;
        newStartPoint.leftDirection = newControl2;
        // تنظیم دسته کنترلی نقطه اصلی برای پیوستگی
        point1.leftDirection = newControl1;
    } else {
        // اضافه کردن نقطه جدید به انتهای مسیر
        var newEndPoint = path.pathPoints.add();
        newEndPoint.anchor = newPoint;
        newEndPoint.leftDirection = newControl2;
        newEndPoint.rightDirection = newPoint;
        // تنظیم دسته کنترلی نقطه اصلی برای پیوستگی
        point2.rightDirection = newControl1;
    }

    // به‌روزرسانی سند
    app.redraw();
}

try {
    extendCurvedPathFromSelectedPoint();
} catch (e) {
    alert("خطا: " + e);
}