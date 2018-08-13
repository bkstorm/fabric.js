(function (global) {

  'use strict';

  // https://en.wikipedia.org/wiki/Circular_segment

  let fabric = global.fabric || (global.fabric = {}),
    extend = fabric.util.object.extend,
    clone = fabric.util.object.clone;

  if (fabric.CurvedText) {
    fabric.warn('fabric.CurvedText is already defined');
    return;
  }
  let stateProperties = fabric.Text.prototype.stateProperties.concat();
  stateProperties.push(
    'radius',
    'spacing',
    'reverse',
    'effect',
    'range',
    'largeFont',
    'smallFont',
  );
  let _dimensionAffectingProps = fabric.Text.prototype._dimensionAffectingProps;
  _dimensionAffectingProps['radius'] = true;
  _dimensionAffectingProps['spacing'] = true;
  _dimensionAffectingProps['reverse'] = true;
  _dimensionAffectingProps['fill'] = true;
  _dimensionAffectingProps['effect'] = true;
  _dimensionAffectingProps['width'] = true;
  _dimensionAffectingProps['height'] = true;
  _dimensionAffectingProps['range'] = true;
  _dimensionAffectingProps['fontSize'] = true;
  _dimensionAffectingProps['shadow'] = true;
  _dimensionAffectingProps['largeFont'] = true;
  _dimensionAffectingProps['smallFont'] = true;

  let delegatedProperties = {
    backgroundColor: true,
    textBackgroundColor: true,
    textDecoration: true,
    stroke: true,
    strokeWidth: true,
    shadow: true,
    fontWeight: true,
    fontStyle: true,
    textAlign: true,
  };

  /**
   * Group class
   * @class fabric.CurvedText
   * @extends fabric.Text
   * @mixes fabric.Collection
   */
  fabric.CurvedText = fabric.util.createClass(fabric.Text, fabric.Collection,
    /** @lends fabric.CurvedText.prototype */ {
      /**
       * Type of an object
       * @type String
       * @default
       */
      type: 'curvedText',
      /**
       * The radius of the curved Text
       * @type Number
       * @default 50
       */
      radius: 50,
      /**
       * The angle of the curved Text
       */
      curvedAngle: 0,
      /**
       * Special Effects, Thanks to fahadnabbasi
       * https://github.com/EffEPi/fabric.curvedText/issues/9
       */
      range: 5,
      smallFont: 10,
      largeFont: 30,
      effect: 'curved',
      /**
       * Spacing between the letters
       * @type fabricNumber
       * @default 20
       */
      spacing: 20,
      /**
       * Reversing the radius (position of the original point)
       * @type Boolean
       * @default false
       */
      reverse: false,
      /**
       * Height of text, it's different from heightOfLines
       */
      distanceBetweenCenterOfTextToCenterOfCircle: 0,
      letters: null,
      /**
       *
       */
      __lineCentralAngles: [],
      __lineRadius: [],
      __charAngles: [],
      /**
       * List of properties to consider when checking if state of an object is changed ({@link fabric.Object#hasStateChanged})
       * as well as for history (undo/redo) purposes
       * @type Array
       */
      stateProperties: stateProperties,
      /**
       * Properties that are delegated to group objects when reading/writing
       * @param {Object} delegatedProperties
       */
      delegatedProperties: delegatedProperties,
      /**
       * Properties which when set cause object to change dimensions
       * @type Object
       * @private
       */
      _dimensionAffectingProps: _dimensionAffectingProps,

      initDimensions: function () {
        this.callSuper('initDimensions');
        this.distanceBetweenCenterOfTextToCenterOfCircle = this.calcDistanceBetweenCenterOfTextToCenterOfCircle();

      },

      _render: function (ctx) {
        this._setTextStyles(ctx);
        // this._renderTextLinesBackground(ctx);
        // this._renderTextDecoration(ctx, 'underline');
        this._renderText(ctx);
        // this._renderTextDecoration(ctx, 'overline');
        // this._renderTextDecoration(ctx, 'linethrough');
      },

      _renderTextCommon: function (ctx, method) {
        this.letters = new fabric.Group([], {
          selectable: false,
          padding: 0
        });
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

        this.letters._calcBounds();
        this.letters._updateObjectsCoords();
        this.width = this.letters.width;

        this.height = this.letters.height;
        console.log('width', this.letters.width);
        console.log('height', this.letters.height);
        this.letters.left = -this.letters.width / 2;
        this.letters.top = -this.letters.height / 2;
        this.letters.render(ctx);
      },

      _renderChar: function (
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

        if (shouldFill) {
          let multiplier = this.reverse ? -1 : 1,
            lineRadius = this.calcLineRadius(lineIndex),
            curAngleDeg = -this.calcLineCentralAngle(lineIndex) / 2,
            curAngleRad;

          let charAngle,
            prevCharAngle = 0;

          for (var i = 0, len = _char.length; i < len; i++) {
            if (this.effect === 'curved') {
              charAngle = ((this.__charBounds[lineIndex][i].width +
                this.spacing) / lineRadius) / (Math.PI / 180);
              curAngleDeg = multiplier *
                ((multiplier * curAngleDeg) + prevCharAngle);
              curAngleRad = fabric.util.degreesToRadians(curAngleDeg);
              prevCharAngle = charAngle;

              // ctx.save();
              // // ctx.rotate(curAngleRad);
              // ctx.fillText(_char[i],
              //   multiplier * (Math.sin(curAngleRad) * lineRadius),
              //   multiplier * -1 * Math.cos(curAngleRad) * lineRadius +
              //   multiplier * this.distanceBetweenCenterOfTextToCenterOfCircle,
              // );
              console.log(
                _char[i],
                'angle', curAngleDeg,
                'left', multiplier * (Math.sin(curAngleRad) * lineRadius),
                'top', multiplier * -1 * Math.cos(curAngleRad) * lineRadius,
              );
              // ctx.restore();

              let textItem = new fabric.Text(_char[i]);
              textItem.set('angle', curAngleDeg);
              textItem.set('left', multiplier * (Math.sin(curAngleRad) * lineRadius));
              textItem.set('top', multiplier * -1 * Math.cos(curAngleRad) * lineRadius +
                multiplier * this.distanceBetweenCenterOfTextToCenterOfCircle);
              textItem.set('padding', 0);
              textItem.set('selectable', false);
              for (var key in this.delegatedProperties) {
                textItem.set(key, this.get(key));
              }
              this.letters.add(textItem);
            }
            else {
              // TODO: the other effects will be supported in the future.
            }
          }

          // var scaleX = letters.get('scaleX');
          // var scaleY = letters.get('scaleY');
          // var angle = letters.get('angle');
          //
          // letters.set('scaleX', 1);
          // letters.set('scaleY', 1);
          // letters.set('angle', 0);

          // Update group coords
          // letters._calcBounds();
          // letters._updateObjectsCoords();
          // letters.saveCoords();
          // letters.render(ctx);

          // console.log('width', letters.width);
          // console.log('height', letters.height);

          // letters.set('scaleX', scaleX);
          // letters.set('scaleY', scaleY);
          // letters.set('angle', angle);

          // this.width = letters.width;
          // this.height = letters.height;
          // console.log('width', letters.width);
          // console.log('height', letters.height);
          // letters.left = -letters.width / 2;
          // letters.top = -letters.height / 2;

        }

        if (shouldStroke) {
          // TODO
        }

        decl && ctx.restore();
      },

      calcTextWidth: function () {
        var maxWidth = this.getLineWidth(0);

        for (var i = 1, len = this._textLines.length; i < len; i++) {
          var currentLineWidth = this.getLineWidth(i);
          if (currentLineWidth > maxWidth) {
            maxWidth = currentLineWidth;
          }
        }

        console.log('calcTextWidth ', maxWidth);
        return maxWidth;
      },

      getLineWidth: function (lineIndex) {
        if (this.__lineWidths[lineIndex]) {
          return this.__lineWidths[lineIndex];
        }

        var width, line = this._textLines[lineIndex];

        if (line === '') {
          width = 0;
        }
        else {
          this.measureLine(lineIndex);
          width = 2 * this.calcLineRadius(lineIndex) * Math.sin(fabric.util.degreesToRadians(this.calcLineCentralAngle(lineIndex) / 2));
        }
        this.__lineWidths[lineIndex] = width;
        return width;
      },

      measureLine: function (lineIndex) {
        var lineInfo = this._measureLine(lineIndex);
        if (this.charSpacing !== 0) {
          lineInfo.textLength -= this._getWidthOfCharSpacing();
        }
        if (lineInfo.textLength < 0) {
          lineInfo.textLength = 0;
        }
        return lineInfo;
      },

      _measureLine: function (lineIndex) {
        var textLength = 0, i, grapheme, line = this._textLines[lineIndex],
          prevGrapheme,
          graphemeInfo, numOfSpaces = 0, lineBounds = new Array(line.length);

        this.__charBounds[lineIndex] = lineBounds;
        for (i = 0; i < line.length; i++) {
          grapheme = line[i];
          graphemeInfo = this._getGraphemeBox(grapheme, lineIndex, i,
            prevGrapheme);
          lineBounds[i] = graphemeInfo;
          textLength += graphemeInfo.kernedWidth + this.spacing;
          prevGrapheme = grapheme;
        }
        // don't add spacing of last char.
        line.length !== 0 && (textLength -= this.spacing);
        // this latest bound box represent the last character of the line
        // to simplify cursor handling in interactive mode.
        lineBounds[i] = {
          left: graphemeInfo ? graphemeInfo.left + graphemeInfo.width : 0,
          width: 0,
          kernedWidth: 0,
          height: this.fontSize,
        };
        return {textLength: textLength, numOfSpaces: numOfSpaces};
      },

      calcTextHeight: function () {
        let minLineOrdinate,
          minLineIndex,
          minOrdinate = this.radius,
          lineRadius,
          lineAngleRad,
          height;

        if (this.effect === 'curved') {
          for (var i = 0, len = this._textLines.length; i < len; i++) {
            lineRadius = this.calcLineRadius(i);
            lineAngleRad = fabric.util.degreesToRadians(
              -this.calcLineCentralAngle(i) / 2);
            if (Math.abs(lineAngleRad) < Math.PI) {
              minLineOrdinate = Math.cos(Math.abs(lineAngleRad));
            }
            else {
              minLineOrdinate = -lineRadius;
            }

            if (minOrdinate > minLineOrdinate) {
              minOrdinate = minLineOrdinate;
              minLineIndex = i;
            }
          }

          height = this.radius + minOrdinate +
            this.getHeightOfLine(minLineIndex);
          console.log('calcTextHeight', 'height = ', height);
          return height;
        }
        else {
          throw this.effect + ' is not supported';
        }
      },

      calcDistanceBetweenCenterOfTextToCenterOfCircle: function () {
        return this.radius + (this.reverse ? this.getHeightOfLine(0) : 0) -
          this.height / 2;
      },

      calcLineRadius: function (lineIndex) {
        if (this.__lineRadius[lineIndex]) {
          return this.__lineRadius[lineIndex];
        }

        let lineRadius = this.radius;
        if (this.reverse) {
          for (var i = this._textLines.length; i > lineIndex; i--) {
            lineRadius -= this.getHeightOfLine(i);
          }
        }
        else {
          for (var i = 0; i < lineIndex; i++) {
            lineRadius -= this.getHeightOfLine(i);
          }
        }

        return (this.__lineRadius[lineIndex] = lineRadius);
      },

      calcLineCentralAngle: function (lineIndex) {
        if (this.__lineCentralAngles[lineIndex]) {
          return this.__lineCentralAngles[lineIndex];
        }

        let textLength = 0,
          line = this._textLines[lineIndex],
          curAngleDegrees;

        if (this.effect === 'curved') {
          // get line width
          for (var i = 0, len = line.length; i < len; i++) {
            textLength += this.__charBounds[lineIndex][i].width + this.spacing;
          }
          textLength -= this.spacing;
        }
        else {
          throw this.effect + ' is not supported';
        }

        // calculate radius of the line

        // text align
        if (this.textAlign === 'right') {
          throw this.textAlign + ' is not supported';
        }
        else if (this.textAlign === 'left') {
          throw this.textAlign + ' is not supported';
        }
        else if (this.textAlign === 'center') {
          //FIXME lineRadius instead of this.radius
          curAngleDegrees = textLength / (this.calcLineRadius(lineIndex) * Math.PI) * 180;
        }

        return (this.__lineCentralAngles[lineIndex] = curAngleDegrees);
      },

      _clearCache: function () {
        this.callSuper('_clearCache');
        this.__lineCentralAngles = [];
        this.__lineRadius = [];
        this.__charAngles = [];
      },
    });

  /**
   * Returns {@link fabric.CurvedText} instance from an object representation
   * @static
   * @memberOf fabric.CurvedText
   * @param {Object} object Object to create a group from
   * @param {Object} [options] Options object
   * @return {fabric.CurvedText} An instance of fabric.CurvedText
   */
  fabric.CurvedText.fromObject = function (object) {
    return new fabric.CurvedText(object.text, clone(object));
  };

  // fabric.util.createAccessors(fabric.CurvedText);

  /**
   * Indicates that instances of this type are async
   * @static
   * @memberOf fabric.CurvedText
   * @type Boolean
   * @default
   */
  fabric.CurvedText.async = false;

})(typeof exports !== 'undefined' ? exports : this);
