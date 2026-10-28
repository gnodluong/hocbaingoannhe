'use strict';

/** Pure history filtering, shared by the renderer and fixture tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HistoryFilter = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const text = (value) => String(value == null ? '' : value).normalize('NFC').trim().replace(/\s+/g, ' ');
  const nameKey = (value) => text(value).toLocaleLowerCase('vi');

  function normalizeSearch(value) {
    return nameKey(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  }

  function classKey(org) {
    return JSON.stringify(['battalion', 'company', 'className'].map(field => text(org[field])));
  }

  function buildHistoryIndex(items = [], roster = []) {
    const classes = new Map();
    const students = new Map();
    const modernByName = new Map();
    const legacyKey = (org, name) => JSON.stringify(['legacy', classKey(org), nameKey(name)]);
    const modernKey = (id) => JSON.stringify(['id', text(id)]);

    function registerClass(org) {
      const key = classKey(org);
      if (!classes.has(key)) {
        const [battalion, company, className] = JSON.parse(key);
        const label = [className || 'Chưa ghi lớp', company, battalion].filter(Boolean).join(' · ');
        classes.set(key, { key, label, battalion, company, className });
      }
      return key;
    }

    function registerStudent(org, name, id) {
      const cls = registerClass(org);
      const key = id ? modernKey(id) : legacyKey(org, name);
      if (!students.has(key)) students.set(key, { key, id: text(id), name: text(name) || 'Chưa ghi tên', classKeys: new Set(), searchNames: new Set() });
      const student = students.get(key);
      student.classKeys.add(cls);
      if (text(name)) student.searchNames.add(normalizeSearch(name));
      if (id && text(name)) {
        const alias = legacyKey(org, name);
        if (!modernByName.has(alias)) modernByName.set(alias, new Set());
        modernByName.get(alias).add(key);
      }
      return key;
    }

    // Roster names take precedence for renamed students; history still adds old classes and aliases.
    roster.forEach(student => {
      registerClass(student);
      if (student.id) registerStudent(student, student.name, student.id);
    });
    items.forEach(item => {
      registerClass(item);
      if (item.studentId) registerStudent(item, item.studentName, item.studentId);
    });

    function resolveLegacy(org, name) {
      if (!text(name)) return null;
      const alias = legacyKey(org, name);
      const matches = modernByName.get(alias);
      // A name without an ID cannot choose between two students with the same class and name.
      if (matches && matches.size === 1) return matches.values().next().value;
      return registerStudent(org, name, null);
    }

    roster.forEach(student => { if (!student.id) resolveLegacy(student, student.name); });
    const itemStudentKeys = items.map(item => item.studentId ? modernKey(item.studentId) : resolveLegacy(item, item.studentName));
    const classList = Array.from(classes.values()).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    const studentList = Array.from(students.values()).map(student => ({
      ...student, classKeys: Array.from(student.classKeys), searchNames: Array.from(student.searchNames),
      label: `${student.name} · ${Array.from(student.classKeys).map(key => classes.get(key).label).join(' / ')}`,
    }));
    const labelCounts = new Map();
    studentList.forEach(student => labelCounts.set(student.label, (labelCounts.get(student.label) || 0) + 1));
    studentList.forEach(student => {
      if (labelCounts.get(student.label) > 1) student.label += student.id ? ` · Mã ${student.id}` : ' · Lịch sử cũ';
    });
    studentList.sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    return { items, classes: classList, students: studentList, itemStudentKeys };
  }

  function studentOptions(index, selectedClass = '') {
    return index.students.filter(student => !selectedClass || student.classKeys.includes(selectedClass));
  }

  function filterHistory(index, { classKey: selectedClass = '', studentKey = '', query = '' } = {}) {
    const keyword = normalizeSearch(query);
    const matchingStudents = new Set(keyword ? index.students
      .filter(student => student.searchNames.some(name => name.includes(keyword))).map(student => student.key) : []);
    return index.items.filter((item, position) => (
      (!selectedClass || classKey(item) === selectedClass)
      && (!studentKey || index.itemStudentKeys[position] === studentKey)
      && (!keyword || matchingStudents.has(index.itemStudentKeys[position]) || normalizeSearch(item.studentName).includes(keyword))
    ));
  }

  return { normalizeSearch, classKey, buildHistoryIndex, studentOptions, filterHistory };
});
