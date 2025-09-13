// Open Corner Script for Adobe Illustrator
// Modified to handle multiple selected points, connect new points, preserve existing curves, handle both open and closed paths, remove redundant middle points, extend handle lengths appropriately, and avoid creating handles for corner points
// Additionally modified to calculate extension length as 1/5 of the sum of incoming and outgoing segment lengths

// تابع برای بررسی انتخاب نقطه
function isSelected(p) {
  return p.selected == PathPointSelection.ANCHORPOINT;
}

// تابع برای استخراج PathItems از انتخاب
function getPathItemsInSelection(n, paths) {
  if (app.documents.length < 1) return;
  var s = app.activeDocument.selection;
  if (!(s instanceof Array) || s.length < 1) return;
  extractPaths(s, n, paths);
}

// تابع برای استخراج مسیرها از انتخاب (شامل گروه‌ها و مسیرهای مرکب)
function extractPaths(s, pp_length_limit, paths) {
  for (var i = 0; i < s.length; i++) {
    if (s[i].typename == "PathItem" && !s[i].guides && !s[i].clipping) {
      if (pp_length_limit && s[i].pathPoints.length <= pp_length_limit) {
        continue;
      }
      paths.push(s[i]);
    } else if (s[i].typename == "GroupItem") {
      extractPaths(s[i].pageItems, pp_length_limit, paths);
    } else if (s[i].typename == "CompoundPathItem") {
      extractPaths(s[i].pathItems, pp_length_limit, paths);
    }
  }
}

// تابع برای بررسی اینکه آیا نقطه دسته دارد یا خیر
function hasHandle(point, direction) {
  if (direction === "left") {
    return point.leftDirection[0] !== point.anchor[0] || point.leftDirection[1] !== point.anchor[1];
  } else {
    return point.rightDirection[0] !== point.anchor[0] || point.rightDirection[1] !== point.anchor[1];
  }
}

// تابع برای پردازش یک نقطه انتخاب‌شده و ایجاد امتداد
function processPoint(path, point, selectedIndex) {
  var points = path.pathPoints;
  var n = points.length;
  var prevIndex = (path.closed && selectedIndex === 0) ? n - 1 : selectedIndex - 1;
  var nextIndex = (path.closed && selectedIndex === n - 1) ? 0 : selectedIndex + 1;

  var prev = points[prevIndex];
  var next = points[nextIndex];
  var anchor = point.anchor;
  var prevAnchor = prev.anchor;
  var nextAnchor = next.anchor;

  // بردار ورودی (از هندل چپ به نقطه)
  var v_in = [anchor[0] - point.leftDirection[0], anchor[1] - point.leftDirection[1]];
  var length_in = Math.sqrt(v_in[0] * v_in[0] + v_in[1] * v_in[1]);
  if (length_in === 0) {
    v_in = [anchor[0] - prevAnchor[0], anchor[1] - prevAnchor[1]];
    length_in = Math.sqrt(v_in[0] * v_in[0] + v_in[1] * v_in[1]);
  }
  if (length_in === 0) {
    throw new Error("طول بردار ورودی صفر است.");
  }
  var unit_in = [v_in[0] / length_in, v_in[1] / length_in];

  // بردار خروجی (از نقطه به هندل راست)
  var v_out = [point.rightDirection[0] - anchor[0], point.rightDirection[1] - anchor[1]];
  var length_out = Math.sqrt(v_out[0] * v_out[0] + v_out[1] * v_out[1]);
  if (length_out === 0) {
    v_out = [nextAnchor[0] - anchor[0], nextAnchor[1] - anchor[1]];
    length_out = Math.sqrt(v_out[0] * v_out[0] + v_out[1] * v_out[1]);
  }
  if (length_out === 0) {
    throw new Error("طول بردار خروجی صفر است.");
  }
  var unit_out = [v_out[0] / length_out, v_out[1] / length_out];

  // محاسبه طول امتداد به صورت نسبتی (یک‌پنجم مجموع طول‌های ورودی و خروجی)
  var ext = (length_in + length_out) / 5;

  // نقاط جدید
  var new1 = [anchor[0] + unit_in[0] * ext, anchor[1] + unit_in[1] * ext];
  var new2 = [anchor[0] - unit_out[0] * ext, anchor[1] - unit_out[1] * ext];

  // بررسی وجود دسته در مسیرهای ورودی و خروجی
  var hasLeftHandle = hasHandle(point, "left");
  var hasRightHandle = hasHandle(point, "right");

  // ایجاد مسیر جدید
  var newPath = app.activeDocument.pathItems.add();
  newPath.filled = path.filled;
  newPath.stroked = path.stroked;
  newPath.closed = path.closed;

  // ضریب افزایش طول بازوها بر اساس فاصله امتداد
  var handleScale = 1 + ext / Math.max(length_in, length_out, 1); // جلوگیری از تقسیم بر صفر

  if (path.closed) {
    // برای مسیر بسته: new2 -> next ... -> prev -> new1, then close to connect new1 -> new2
    var newPoint2 = newPath.pathPoints.add();
    newPoint2.anchor = new2;
    newPoint2.leftDirection = new2;
    if (hasRightHandle) {
      newPoint2.rightDirection = [
        new2[0] + unit_out[0] * (length_out * handleScale),
        new2[1] + unit_out[1] * (length_out * handleScale)
      ];
      newPoint2.pointType = PointType.SMOOTH;
    } else {
      newPoint2.rightDirection = new2;
      newPoint2.pointType = PointType.CORNER;
    }

    // اضافه کردن نقاط میانی از nextIndex تا prevIndex
    var idx = nextIndex;
    var prevPoint = null;
    while (true) {
      var oldPoint = points[idx];
      var newPoint = newPath.pathPoints.add();
      newPoint.anchor = oldPoint.anchor;
      newPoint.leftDirection = oldPoint.leftDirection;
      newPoint.rightDirection = oldPoint.rightDirection;
      newPoint.pointType = oldPoint.pointType;

      if (idx === prevIndex) {
        prevPoint = newPoint;
      }
      if (idx === prevIndex) break;
      idx = (idx + 1) % n;
    }

    var newPoint1 = newPath.pathPoints.add();
    newPoint1.anchor = new1;
    if (hasLeftHandle) {
      newPoint1.leftDirection = [
        new1[0] - unit_in[0] * (length_in * handleScale),
        new1[1] - unit_in[1] * (length_in * handleScale)
      ];
      newPoint1.rightDirection = new1;
      newPoint1.pointType = PointType.SMOOTH;
    } else {
      newPoint1.leftDirection = new1;
      newPoint1.rightDirection = new1;
      newPoint1.pointType = PointType.CORNER;
    }

    newPath.closed = true;

  } else {
    // برای مسیر باز: start ... prev -> new1 -> new2 -> next ... end
    var prevPoint = null;
    var pointAfterNew2 = null;

    for (var i = 0; i <= prevIndex; i++) {
      var oldPoint = points[i];
      var newPoint = newPath.pathPoints.add();
      newPoint.anchor = oldPoint.anchor;
      newPoint.leftDirection = oldPoint.leftDirection;
      newPoint.rightDirection = oldPoint.rightDirection;
      newPoint.pointType = oldPoint.pointType;

      if (i === prevIndex) {
        prevPoint = newPoint;
      }
    }

    var newPoint1 = newPath.pathPoints.add();
    newPoint1.anchor = new1;
    if (hasLeftHandle) {
      newPoint1.leftDirection = [
        new1[0] - unit_in[0] * (length_in * handleScale),
        new1[1] - unit_in[1] * (length_in * handleScale)
      ];
      newPoint1.rightDirection = new1;
      newPoint1.pointType = PointType.SMOOTH;
    } else {
      newPoint1.leftDirection = new1;
      newPoint1.rightDirection = new1;
      newPoint1.pointType = PointType.CORNER;
    }

    var newPoint2 = newPath.pathPoints.add();
    newPoint2.anchor = new2;
    if (hasRightHandle) {
      newPoint2.leftDirection = new2;
      newPoint2.rightDirection = [
        new2[0] + unit_out[0] * (length_out * handleScale),
        new2[1] + unit_out[1] * (length_out * handleScale)
      ];
      newPoint2.pointType = PointType.SMOOTH;
    } else {
      newPoint2.leftDirection = new2;
      newPoint2.rightDirection = new2;
      newPoint2.pointType = PointType.CORNER;
    }

    for (var i = nextIndex; i < n; i++) {
      var oldPoint = points[i];
      var newPoint = newPath.pathPoints.add();
      newPoint.anchor = oldPoint.anchor;
      newPoint.leftDirection = oldPoint.leftDirection;
      newPoint.rightDirection = oldPoint.rightDirection;
      newPoint.pointType = oldPoint.pointType;

      if (i === nextIndex) {
        pointAfterNew2 = newPoint;
      }
    }

    newPath.closed = false;
  }

  return newPath;
}

// تابع اصلی
function main() {
  if (app.documents.length === 0) {
    alert("هیچ سندی باز نیست.");
    return;
  }

  var doc = app.activeDocument;
  var paths = [];
  getPathItemsInSelection(2, paths); // حداقل 2 نقطه برای مسیر

  if (paths.length === 0) {
    alert("هیچ مسیری انتخاب نشده است. لطفاً یک مسیر انتخاب کنید.");
    return;
  }

  for (var s = paths.length - 1; s >= 0; s--) {
    var path = paths[s];
    var pathPoints = path.pathPoints;
    var selectedPoints = [];

    // جمع‌آوری تمام نقاط انتخاب‌شده
    for (var pIdx = 0; pIdx < pathPoints.length; pIdx++) {
      if (isSelected(pathPoints[pIdx])) {
        selectedPoints.push({ point: pathPoints[pIdx], index: pIdx });
      }
    }

    if (selectedPoints.length === 0) {
      alert("هیچ نقطه‌ای در مسیر انتخاب نشده است: " + (s + 1));
      continue;
    }

    // بررسی نقاط ابتدا یا انتهای مسیرهای باز
    for (var i = 0; i < selectedPoints.length; i++) {
      var selectedIndex = selectedPoints[i].index;
      if (!path.closed && (selectedIndex === 0 || selectedIndex === pathPoints.length - 1)) {
        alert("نقاط ابتدا یا انتهای مسیرهای باز پشتیبانی نمی‌شوند. لطفاً نقاط داخلی انتخاب کنید.");
        continue;
      }
    }

    // اگر فقط یک نقطه انتخاب شده، مسیر را مستقیماً پردازش می‌کنیم
    if (selectedPoints.length === 1) {
      try {
        var newPath = processPoint(path, selectedPoints[0].point, selectedPoints[0].index);
        path.remove();
        newPath.selected = true;
      } catch (e) {
        alert("خطا در پردازش مسیر: " + e + "\nلطفاً مطمئن شوید که مسیر و نقطه انتخاب‌شده معتبر هستند.");
        continue;
      }
    } else {
      // برای چندین نقطه انتخاب‌شده، مسیر را به بخش‌های جداگانه تقسیم می‌کنیم
      var sortedPoints = selectedPoints.sort(function(a, b) { return a.index - b.index; });
      var newPaths = [];
      var startIdx = 0;

      for (var i = 0; i < sortedPoints.length; i++) {
        var selectedIndex = sortedPoints[i].index;
        var tempPath = doc.pathItems.add();
        tempPath.filled = path.filled;
        tempPath.stroked = path.stroked;
        tempPath.closed = false;

        // کپی نقاط از startIdx تا selectedIndex
        for (var j = startIdx; j <= selectedIndex; j++) {
          var oldPoint = pathPoints[j];
          var newPoint = tempPath.pathPoints.add();
          newPoint.anchor = oldPoint.anchor;
          newPoint.leftDirection = oldPoint.leftDirection;
          newPoint.rightDirection = oldPoint.rightDirection;
          newPoint.pointType = oldPoint.pointType;
        }

        try {
          // پردازش نقطه انتخاب‌شده و ایجاد امتداد
          var tempNewPath = processPoint(path, sortedPoints[i].point, selectedIndex);
          newPaths.push(tempNewPath);
        } catch (e) {
          alert("خطا در پردازش نقطه در شاخص " + selectedIndex + ": " + e);
          tempPath.remove();
          continue;
        }

        startIdx = selectedIndex + 1;
      }

      // اضافه کردن بخش آخر مسیر (از آخرین نقطه انتخاب‌شده تا انتها)
      if (startIdx < pathPoints.length) {
        var lastPath = doc.pathItems.add();
        lastPath.filled = path.filled;
        lastPath.stroked = path.stroked;
        lastPath.closed = false;
        for (var j = startIdx; j < pathPoints.length; j++) {
          var oldPoint = pathPoints[j];
          var newPoint = lastPath.pathPoints.add();
          newPoint.anchor = oldPoint.anchor;
          newPoint.leftDirection = oldPoint.leftDirection;
          newPoint.rightDirection = oldPoint.rightDirection;
          newPoint.pointType = oldPoint.pointType;
        }
        newPaths.push(lastPath);
      }

      // حذف مسیر اصلی
      path.remove();

      // انتخاب تمام مسیرهای جدید
      for (var i = 0; i < newPaths.length; i++) {
        newPaths[i].selected = true;
      }
    }
  }
}

// اجرای تابع اصلی
main();