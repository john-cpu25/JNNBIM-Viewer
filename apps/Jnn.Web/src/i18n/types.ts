export type Locale = 'vi' | 'en';

export interface Translations {
  // Common
  'common.ok': string;
  'common.cancel': string;
  'common.close': string;
  'common.delete': string;
  'common.save': string;
  'common.reset': string;
  'common.search': string;
  'common.loading': string;
  'common.error': string;
  'common.unitMeter': string;
  'common.all': string;

  // TopBar
  'topbar.openIfc': string;
  'topbar.appendModel': string;
  'topbar.settings': string;
  'topbar.language': string;
  'topbar.theme': string;

  // Viewport empty state & notices
  'viewport.title': string;
  'viewport.subtitle': string;
  'viewport.openButton': string;
  'viewport.converting': string;
  'viewport.offlineNotice': string;
  'viewport.webglError': string;
  'viewport.webglDriverHelp': string;
  'viewport.navHint': string;
  'viewport.pickFaceHint': string;

  // Toolbar
  'toolbar.fitAll': string;
  'toolbar.fitSelection': string;
  'toolbar.hide': string;
  'toolbar.isolate': string;
  'toolbar.showAll': string;
  'toolbar.sectionPlane': string;
  'toolbar.sectionBox': string;
  'toolbar.xray': string;
  'toolbar.projection': string;
  'toolbar.grid': string;
  'toolbar.clearSelection': string;

  // Navigation Help Popover
  'nav.helpTitle': string;
  'nav.presetRevit': string;
  'nav.presetClassic': string;
  'nav.orbit': string;
  'nav.pan': string;
  'nav.zoom': string;
  'nav.fitAll': string;
  'nav.fitSelection': string;
  'nav.revitOrbitDesc': string;
  'nav.classicOrbitDesc': string;
  'nav.panDesc': string;
  'nav.zoomDesc': string;
  'nav.fitAllDesc': string;
  'nav.fitSelectionDesc': string;
  'nav.changeSettings': string;

  // Right Panel Tabs
  'tab.properties': string;
  'tab.clash': string;
  'tab.rules': string;

  // Explorer
  'explorer.title': string;
  'explorer.spatial': string;
  'explorer.category': string;
  'explorer.models': string;
  'explorer.searchPlaceholder': string;
  'explorer.noElements': string;

  // Properties
  'properties.title': string;
  'properties.noSelection': string;
  'properties.selectionCount': string;
  'properties.attributes': string;
  'properties.quantities': string;
  'properties.propertySets': string;
  'properties.aggregateTitle': string;
  'properties.totalCount': string;
  'properties.totalLength': string;
  'properties.totalArea': string;
  'properties.totalVolume': string;
  'properties.name': string;
  'properties.class': string;
  'properties.guid': string;
  'properties.model': string;
  'properties.storey': string;

  // Section Box / Plane
  'section.boxTitle': string;
  'section.planeTitle': string;
  'section.hideFrame': string;
  'section.showFrame': string;
  'section.close': string;
  'section.fitSelection': string;
  'section.fitModel': string;
  'section.reset': string;
  'section.byStorey': string;
  'section.cutAlongX': string;
  'section.cutAlongY': string;
  'section.planCutZ': string;
  'section.flipDirection': string;
  'section.offset': string;
  'section.pickFace': string;
  'section.cutByStorey': string;

  // Clash Panel
  'clash.title': string;
  'clash.addTest': string;
  'clash.renameTest': string;
  'clash.duplicateTest': string;
  'clash.deleteTest': string;
  'clash.run': string;
  'clash.running': string;
  'clash.cancel': string;
  'clash.export': string;
  'clash.importBcf': string;
  'clash.exportCsv': string;
  'clash.exportExcel': string;
  'clash.exportHtml': string;
  'clash.exportBcf': string;
  'clash.tolerance': string;
  'clash.typeHard': string;
  'clash.typeClearance': string;
  'clash.typeDuplicates': string;
  'clash.exportJson': string;
  'clash.importJson': string;
  'clash.testList': string;
  'clash.tabConfig': string;
  'clash.tabResults': string;
  'clash.presets': string;
  'clash.testName': string;
  'clash.clashType': string;
  'clash.hardDesc': string;
  'clash.clearanceDesc': string;
  'clash.duplicatesDesc': string;
  'clash.ignoreSameModel': string;
  'clash.testCompleted': string;
  'clash.clashesDetected': string;
  'clash.clashesCount': string;
  'clash.noClashes': string;
  'clash.elementsCount': string;
  'clash.errorToleranceNegative': string;
  'clash.errorClearanceZero': string;
  'clash.testingProgress': string;
  'clash.bcfNoTopics': string;
  'clash.bcfImportSuccess': string;
  'clash.bcfMissingElementsWarning': string;
  'clash.bcfImportError': string;
  'clash.jsonInvalidError': string;
  'clash.testCancelled': string;
  'clash.testFailed': string;
  'clash.modelLabel': string;
  'clash.allModelsCount': string;
  'clash.ifcClassLabel': string;
  'clash.ifcClassPlaceholderA': string;
  'clash.ifcClassPlaceholderB': string;
  'clash.selectionA': string;
  'clash.selectionB': string;
  'clash.allModels': string;
  'clash.allClasses': string;
  'clash.statusAll': string;
  'clash.statusNew': string;
  'clash.statusActive': string;
  'clash.statusReviewed': string;
  'clash.statusApproved': string;
  'clash.statusResolved': string;
  'clash.noTests': string;
  'clash.noResults': string;
  'clash.colIndex': string;
  'clash.colStatus': string;
  'clash.colType': string;
  'clash.colElementA': string;
  'clash.colElementB': string;
  'clash.colStorey': string;
  'clash.colPoint': string;
  'clash.colComments': string;
  'clash.colAssignedTo': string;
  'clash.enableSectionBox': string;
  'clash.searchPlaceholder': string;

  // Rules
  'rules.title': string;
  'rules.runAll': string;
  'rules.running': string;
  'rules.exportHtml': string;
  'rules.severityAll': string;
  'rules.severityError': string;
  'rules.severityWarning': string;
  'rules.severityInfo': string;
  'rules.passed': string;
  'rules.failed': string;
  'rules.totalIssues': string;
  'rules.colSeverity': string;
  'rules.colRule': string;
  'rules.colElement': string;
  'rules.colMessage': string;
  'rules.noIssues': string;

  // Settings
  'settings.title': string;
  'settings.language': string;
  'settings.navTitle': string;
  'settings.navPreset': string;
  'settings.rotateSpeed': string;
  'settings.zoomSpeed': string;
  'settings.invertZoom': string;
  'settings.showPivot': string;
  'settings.resetNav': string;
  'settings.cacheTitle': string;
  'settings.cacheDesc': string;
  'settings.clearCache': string;
  'settings.cacheCleared': string;

  // Loader
  'loader.notReady': string;
  'loader.downloadingSample': string;
  'loader.notIfc': string;
  'loader.readingFile': string;
  'loader.notSupported': string;
  'loader.loadingModel': string;
  'loader.addingModel': string;
  'loader.appendedSuccess': string;
  'loader.openedSuccess': string;
  'loader.errorOpening': string;
  'loader.fromCache': string;

  // Clash Extra
  'clash.presetStructArch': string;
  'clash.presetMepStruct': string;
  'clash.presetArchStruct': string;
  'clash.errorExportExcel': string;
  'clash.errorExportHtml': string;
  'clash.errorExportBcf': string;
  'clash.searchPlaceholderFilter': string;
  'clash.filterAllCount': string;
  'clash.filterAllTypes': string;
  'clash.shortcutsHint': string;
  'clash.colDistance': string;
  'clash.zoomClash': string;
  'clash.closeDetail': string;
  'clash.statusLabel': string;
  'clash.elementALabel': string;
  'clash.elementBLabel': string;
  'clash.assignedToLabel': string;
  'clash.assignedToPlaceholder': string;
  'clash.commentsPlaceholder': string;

  // Explorer Extra
  'explorer.modelRemoved': string;
  'explorer.elementCount': string;
  'explorer.storeyCount': string;
  'explorer.hideModel': string;
  'explorer.showModel': string;
  'explorer.zoomModel': string;
  'explorer.removeModel': string;

  // Properties Extra
  'properties.offlineDesc': string;

  // Rules Extra
  'rules.checking': string;
  'rules.applicableRules': string;
  'rules.unselectAll': string;
  'rules.selectAll': string;
  'rules.totalViolations': string;
  'rules.errorLabel': string;
  'rules.warningLabel': string;
  'rules.infoLabel': string;
  'rules.duration': string;
  'rules.elementsChecked': string;
  'rules.filterPlaceholder': string;
  'rules.allSeverityCount': string;
  'rules.noIssuesGreat': string;
  'rules.noIssuesCompliant': string;
  'rules.noIssuesFilter': string;

  // Section Extra
  'section.cutStorey': string;
  'section.pickFaceTooltip': string;

  // Settings Extra
  'settings.cacheClearSuccess': string;
  'settings.cacheClearError': string;
  'settings.cacheClearErr': string;
  'settings.revitOptionDesc': string;
  'settings.classicOptionDesc': string;
  'settings.orbitAroundCursor': string;
  'settings.langVi': string;
  'settings.langEn': string;
  'settings.cacheStatusLabel': string;
  'settings.cacheStatusActive': string;
  'settings.cacheStatusUnsupported': string;
  'settings.cacheSizeLabel': string;
  'settings.attributionTitle': string;
  'settings.attributionDesc': string;

  // TopBar Extra
  'topbar.sampleArchTooltip': string;
  'topbar.sampleArch': string;
  'topbar.sampleStructTooltip': string;
  'topbar.sampleStruct': string;
  'topbar.switchToVi': string;
  'topbar.switchToEn': string;

  // Viewport Extra
  'viewport.loadingDropFile': string;
  'viewport.processing': string;
  'viewport.readingIfc': string;
  'viewport.sampleArch': string;
  'viewport.sampleStruct': string;
}

export type TranslationKey = keyof Translations;
