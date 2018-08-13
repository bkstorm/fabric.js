(function(global) {
  'use strict';

  var fabric = global.fabric || (global.fabric = {}),
  clone = fabric.util.object.clone;

  if (fabric.VerticalText) {
    fabric.warn('fabric.VerticalText is already defined');
    return;
  }

  fabric.VerticalText = fabric.util.createClass(fabric.Text, {
    // initialize: function(text, options) {
    //   this.callSuper('initialize', text, options);
    // },

    _render: function(ctx) {
      this._setTextStyles(ctx);
      // this._renderTextLinesBackground(ctx);
      // this._renderTextDecoration(ctx, 'underline');
      this._renderText(ctx);
      // this._renderTextDecoration(ctx, 'overline');
      // this._renderTextDecoration(ctx, 'linethrough');
    },

    _renderTextCommon: function(ctx, method) {
      ctx.save();
      var left = this._getLeftOffset(),
      top = this._getTopOffset(),
      offsets = this._applyPatternGradientTransform(
        ctx,
        method === 'fillText' ? this.fill : this.stroke,
      );
      for (var i = 0, len = this._textLines.length; i < len; i++) {
        var leftOffset = this._getLineLeftOffset(i);
        this._renderTextLine(
          method,
          ctx,
          this._textLines[i],
          left + leftOffset - offsets.offsetX,
          top - offsets.offsetY,
          i,
        );
      }
      ctx.restore();
    },

    _getLineLeftOffset: function(lineIndex) {
      var left = 0,
      right = 0;
      for (var i = 0; i <= lineIndex; i++) {
        right += this.getLineWidth(i);
      }
      for (var i = this._textLines.length - 1; i > lineIndex; i--) {
        left += this.getLineWidth(i);
      }

      if (this.textAlign === 'left') {
        return left;
      }
      if (this.textAlign === 'center') {
        return (this.width + left - right) / 2;
      }
      if (this.textAlign === 'right') {
        return this.width - right;
      }
      if (this.textAlign === 'justify-left') {
        return left;
      }
      if (this.textAlign === 'justify-center') {
        return (this.width + left - right) / 2;
      }
      if (this.textAlign === 'justify-right') {
        return this.width - right;
      }
      return 0;
    },

    _renderChars: function(method, ctx, line, left, top, lineIndex) {
      // set proper line offset
      // var lineHeight = this.getHeightOfLine(lineIndex),
      var isJustify = this.textAlign.indexOf('justify') !== -1,
      actualStyle,
      nextStyle,
      charsToRender = '',
      charBox,
      // boxWidth = 0,
      boxHeight = 0,
      timeToRender,
      shortCut =
      !isJustify && this.charSpacing === 0 && this.isEmptyStyles(lineIndex);

      ctx.save();
      // top -= lineHeight * this._fontSizeFraction / this.lineHeight;
      if (shortCut) {
        // render all the line in one pass without checking
        this._renderChar(
          method,
          ctx,
          lineIndex,
          0,
          this.textLines[lineIndex],
          left,
          top,
        );
        ctx.restore();
        return;
      }

      for (var i = 0, len = line.length - 1; i <= len; i++) {
        timeToRender = i === len || this.charSpacing;
        charsToRender += line[i];
        charBox = this.__charBounds[lineIndex][i];
        if (boxHeight === 0) {
          // left += charBox.kernedWidth - charBox.width;
          top += charBox.kernedWidth - charBox.height;
          // boxWidth += charBox.width;
          boxHeight += charBox.height;
        }
        else {
          // boxWidth += charBox.kernedWidth;
          boxHeight += charBox.kernedWidth;
        }
        if (isJustify && !timeToRender) {
          if (this._reSpaceAndTab.test(line[i])) {
            timeToRender = true;
          }
        }
        if (!timeToRender) {
          // if we have charSpacing, we render char by char
          actualStyle =
          actualStyle || this.getCompleteStyleDeclaration(lineIndex, i);
          nextStyle = this.getCompleteStyleDeclaration(lineIndex, i + 1);
          timeToRender = this._hasStyleChanged(actualStyle, nextStyle);
        }
        if (timeToRender) {
          this._renderChar(
            method,
            ctx,
            lineIndex,
            i,
            charsToRender,
            left,
            top,
            lineHeight,
          );
          charsToRender = '';
          actualStyle = nextStyle;
          // left += boxWidth;
          top += boxHeight;
          // boxWidth = 0;
          boxHeight = 0;
        }
      }
      ctx.restore();
    },

    _renderChar: function(
      method, ctx, lineIndex, charIndex, _char, left, top) {
        var decl = this._getStyleDeclaration(lineIndex, charIndex),
        fullDecl = this.getCompleteStyleDeclaration(lineIndex, charIndex),
        shouldFill = method === 'fillText' && fullDecl.fill,
        shouldStroke =
        method === 'strokeText' && fullDecl.stroke && fullDecl.strokeWidth;

        if (!shouldStroke && !shouldFill) {
          return;
        }
        decl && ctx.save();

        this._applyCharStyles(method, ctx, lineIndex, charIndex, fullDecl);

        if (decl && decl.textBackgroundColor) {
          this._removeShadow(ctx);
        }
        if (decl && decl.deltaY) {
          top += decl.deltaY;
        }

        // shouldFill && ctx.fillText(_char, left, top);
        if (shouldFill) {
          var rowHeight =
          this.getHeightOfChar(lineIndex, 0) *
          this.lineHeight *
          this._fontSizeMult;
          var lineHeights = rowHeight;
          ctx.fillText(_char[0], left, top + (rowHeight / this.lineHeight) *
          (1 - this._fontSizeFraction));
          // ctx.fillText(_char[0], left, top + (rowHeight) * (1 - this._fontSizeFraction));
          for (var i = 1, len = _char.length; i < len; i++) {
            rowHeight =
            this.getHeightOfChar(lineIndex, i) *
            this.lineHeight *
            this._fontSizeMult;
            ctx.fillText(_char[i], left, top + lineHeights +
              (rowHeight / this.lineHeight) * (1 - this._fontSizeFraction));
              // ctx.fillText(_char[i], left, top + lineHeights + (rowHeight) * (1 - this._fontSizeFraction));
              lineHeights += rowHeight;
            }
          }
          // shouldStroke && ctx.strokeText(_char, left, top );
          decl && ctx.restore();
        },

        _renderTextStroke: function(ctx) {
        },

        calcTextWidth: function() {
          var lineWidth,
          width = 0;
          for (var i = 0, len = this._textLines.length; i < len; i++) {
            lineWidth = this.getLineWidth(i);
            width += lineWidth;
          }
          return width;
        },

        getLineWidth: function(lineIndex) {
          if (this.__lineWidths[lineIndex]) {
            return this.__lineWidths[lineIndex];
          }

          var line = this._textLines[lineIndex],
          graphemeInfo,
          maxWidth = 0;

          this.__charBounds[lineIndex] = new Array(line.length);
          for (var i = 0, len = line.length; i < len; i++) {
            graphemeInfo = this._getGraphemeBox(line[i], lineIndex, i, undefined);
            this.__charBounds[lineIndex][i] = graphemeInfo;
            if (graphemeInfo.width > maxWidth) {
              maxWidth = graphemeInfo.width;
            }
          }
          return maxWidth * this.lineHeight * this._fontSizeMult;
        },

        calcTextHeight: function() {
          var currentLineHeight,
          maxHeight = this.getHeightOfLine(0);
          for (var i = 1, len = this._textLines.length; i < len; i++) {
            currentLineHeight = this.getHeightOfLine(i);
            if (currentLineHeight > maxHeight) {
              maxHeight = currentLineHeight;
            }
          }
          return maxHeight;
        },

        getHeightOfLine: function(lineIndex) {
          if (this.__lineHeights[lineIndex]) {
            return this.__lineHeights[lineIndex];
          }

          var line = this._textLines[lineIndex],
          height = 0,
          charHeight = 0;
          for (var i = 0, len = line.length; i < len; i++) {
            charHeight =
            this.getHeightOfChar(lineIndex, i) *
            this.lineHeight *
            this._fontSizeMult;
            height += i === len - 1 ? charHeight / this.lineHeight : charHeight;
            // height += charHeight;
          }

          return (this.__lineHeights[lineIndex] = height);
        },
      });
    })(typeof exports !== 'undefined' ? exports : this);
