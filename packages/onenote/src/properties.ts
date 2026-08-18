/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

export enum OneNoteProperties {
  LayoutTightLayout = 0x08001c00,
  PageWidth = 0x14001c01,
  PageHeight = 0x14001c02,

  OutlineElementChildLevel = 0x0c001c03,
  Bold = 0x08001c04,
  Italic = 0x08001c05,

  Underline = 0x08001c06,
  Strikethrough = 0x08001c07,
  Superscript = 0x08001c08,

  Subscript = 0x08001c09,
  Font = 0x1c001c0a,
  FontSize = 0x10001c0b,
  FontColor = 0x14001c0c,

  Highlight = 0x14001c0d,
  RgOutlineIndentDistance = 0x1c001c12,
  BodyTextAlignment = 0x0c001c13,

  OffsetFromParentHoriz = 0x14001c14,
  OffsetFromParentVert = 0x14001c15,

  NumberListFormat = 0x1c001c1a,
  LayoutMaxWidth = 0x14001c1b,
  LayoutMaxHeight = 0x14001c1c,

  ContentChildNodesOfOutlineElement = 0x24001c1f,
  ContentChildNodesOfPageManifest = 0x24001c1f,

  /**
   * Includes:
   *
   * - ElementChildNodesOfSection
   * - ElementChildNodesOfPage
   * - ElementChildNodesOfTitle
   * - ElementChildNodesOfOutline
   * - ElementChildNodesOfOutlineElement
   * - ElementChildNodesOfTable
   * - ElementChildNodesOfTableRow
   * - ElementChildNodesOfTableCell
   * - ElementChildNodesOfVersionHistory
   */
  ElementChildNodes = 0x24001c20,

  EnableHistory = 0x08001e1e,

  RichEditTextUnicode = 0x1c001c22,
  ListNodes = 0x24001c26,

  NotebookManagementEntityGuid = 0x1c001c30,
  OutlineElementRTL = 0x08001c34,
  LanguageID = 0x14001c3b,

  LayoutAlignmentInParent = 0x14001c3e,
  PictureContainer = 0x20001c3f,
  PageMarginTop = 0x14001c4c,

  PageMarginBottom = 0x14001c4d,
  PageMarginLeft = 0x14001c4e,
  PageMarginRight = 0x14001c4f,

  ListFont = 0x1c001c52,
  TopologyCreationTimeStamp = 0x18001c65,
  LayoutAlignmentSelf = 0x14001c84,

  IsTitleTime = 0x08001c87,
  IsBoilerText = 0x08001c88,
  PageSize = 0x14001c8b,

  PortraitPage = 0x08001c8e,
  EnforceOutlineStructure = 0x08001c91,
  EditRootRTL = 0x08001c92,

  CannotBeSelected = 0x08001cb2,
  IsTitleText = 0x08001cb4,
  IsTitleDate = 0x08001cb5,

  ListRestart = 0x14001cb7,
  IsLayoutSizeSetByUser = 0x08001cbd,
  ListSpacingMu = 0x14001ccb,

  LayoutOutlineReservedWidth = 0x14001cdb,
  LayoutResolveChildCollisions = 0x08001cdc,

  IsReadOnly = 0x08001cde,
  LayoutMinimumOutlineWidth = 0x14001cec,

  LayoutCollisionPriority = 0x14001cf1,
  CachedTitleString = 0x1c001cf3,

  DescendantsCannotBeMoved = 0x08001cf9,
  RichEditTextLangID = 0x10001cfe,

  LayoutTightAlignment = 0x08001cff,
  Charset = 0x0c001d01,
  CreationTimeStamp = 0x14001d09,

  Deletable = 0x08001d0c,
  ListMSAAIndex = 0x10001d0e,
  IsBackground = 0x08001d13,

  IRecordMedia = 0x14001d24,
  CachedTitleStringFromPage = 0x1c001d3c,
  RowCount = 0x14001d57,

  ColumnCount = 0x14001d58,
  TableBordersVisible = 0x08001d5e,

  StructureElementChildNodes = 0x24001d5f,
  ChildGraphSpaceElementNodes = 0x2c001d63,

  TableColumnWidths = 0x1c001d66,
  Author = 0x1c001d75,
  LastModifiedTimeStamp = 0x18001d77,

  AuthorOriginal = 0x20001d78,
  AuthorMostRecent = 0x20001d79,
  LastModifiedTime = 0x14001d7a,

  IsConflictPage = 0x08001d7c,
  TableColumnsLocked = 0x1c001d7d,

  SchemaRevisionInOrderToRead = 0x14001d82,
  SchemaRevisionInOrderToWrite = 0x1400348b,
  IsConflictObjectForRender = 0x08001d96,

  EmbeddedFileContainer = 0x20001d9b,
  EmbeddedFileName = 0x1c001d9c,
  SourceFilepath = 0x1c001d9d,

  ConflictingUserName = 0x1c001d9e,
  ImageFilename = 0x1c001dd7,

  IsConflictObjectForSelection = 0x08001ddb,
  PageLevel = 0x14001dff,
  TextRunIndex = 0x1c001e12,

  TextRunFormatting = 0x24001e13,
  Hyperlink = 0x08001e14,
  UnderlineType = 0x0c001e15,

  Hidden = 0x08001e16,
  HyperlinkProtected = 0x08001e19,
  TextRunIsEmbeddedObject = 0x08001e22,

  ImageAltText = 0x1c001e58,
  MathFormatting = 0x08003401,
  ParagraphStyle = 0x2000342c,

  ParagraphSpaceBefore = 0x1400342e,
  ParagraphSpaceAfter = 0x1400342f,

  ParagraphLineSpacingExact = 0x14003430,
  MetaDataObjectsAboveGraphSpace = 0x24003442,

  TextRunDataObject = 0x24003458,
  TextRunData = 0x40003499,
  ParagraphStyleId = 0x1c00345a,

  HasVersionPages = 0x08003462,
  ActionItemType = 0x10003463,
  NoteTagShape = 0x10003464,

  NoteTagHighlightColor = 0x14003465,
  NoteTagTextColor = 0x14003466,

  NoteTagPropertyStatus = 0x14003467,
  NoteTagLabel = 0x1c003468,
  NoteTagCreated = 0x1400346e,

  NoteTagCompleted = 0x1400346f,
  NoteTagDefinitionOid = 0x20003488,
  NoteTagStates = 0x04003489,

  ActionItemStatus = 0x10003470,
  ActionItemSchemaVersion = 0x0c003473,
  ReadingOrderRTL = 0x08003476,

  ParagraphAlignment = 0x0c003477,
  VersionHistoryGraphSpaceContextNodes = 0x3400347b,

  DisplayedPageNumber = 0x14003480,
  SectionDisplayName = 0x1c00349b,
  NextStyle = 0x1c00348a,

  WebPictureContainer14 = 0x200034c8,
  ImageUploadState = 0x140034cb,
  TextExtendedAscii = 0x1c003498,

  PictureWidth = 0x140034cd,
  PictureHeight = 0x140034ce,
  PageMarginOriginX = 0x14001d0f,

  PageMarginOriginY = 0x14001d10,
  WzHyperlinkUrl = 0x1c001e20,
  TaskTagDueDate = 0x1400346b,

  Unknown = 0x00000000,
}
