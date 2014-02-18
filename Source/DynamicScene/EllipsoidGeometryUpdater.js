/*global define*/
define(['../Core/Cartesian3',
        '../Core/Color',
        '../Core/ColorGeometryInstanceAttribute',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/destroyObject',
        '../Core/DeveloperError',
        '../Core/EllipsoidGeometry',
        '../Core/EllipsoidOutlineGeometry',
        '../Core/Event',
        '../Core/GeometryInstance',
        '../Core/Iso8601',
        '../Core/Matrix3',
        '../Core/Matrix4',
        '../Core/ShowGeometryInstanceAttribute',
        '../DynamicScene/ColorMaterialProperty',
        '../DynamicScene/ConstantProperty',
        '../DynamicScene/MaterialProperty',
        '../Scene/MaterialAppearance',
        '../Scene/PerInstanceColorAppearance',
        '../Scene/Primitive'
    ], function(
        Cartesian3,
        Color,
        ColorGeometryInstanceAttribute,
        defaultValue,
        defined,
        defineProperties,
        destroyObject,
        DeveloperError,
        EllipsoidGeometry,
        EllipsoidOutlineGeometry,
        Event,
        GeometryInstance,
        Iso8601,
        Matrix3,
        Matrix4,
        ShowGeometryInstanceAttribute,
        ColorMaterialProperty,
        ConstantProperty,
        MaterialProperty,
        MaterialAppearance,
        PerInstanceColorAppearance,
        Primitive) {
    "use strict";

    var defaultMaterial = ColorMaterialProperty.fromColor(Color.WHITE);
    var defaultShow = new ConstantProperty(true);
    var defaultFill = new ConstantProperty(true);
    var defaultOutline = new ConstantProperty(false);
    var defaultOutlineColor = new ConstantProperty(Color.BLACK);

    var positionScratch;
    var orientationScratch;
    var radiiScratch;
    var matrix3Scratch;

    var GeometryOptions = function(dynamicObject) {
        this.id = dynamicObject;
        this.vertexFormat = undefined;
        this.radii = undefined;
        this.stackPartitions = undefined;
        this.slicePartitions = undefined;
        this.subdivisions = undefined;
    };

    var EllipsoidGeometryUpdater = function(dynamicObject) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(dynamicObject)) {
            throw new DeveloperError('dynamicObject is required');
        }
        //>>includeEnd('debug');

        this._dynamicObject = dynamicObject;
        this._dynamicObjectSubscription = dynamicObject.definitionChanged.addEventListener(EllipsoidGeometryUpdater.prototype._onDynamicObjectPropertyChanged, this);
        this._fillEnabled = false;
        this._dynamic = false;
        this._outlineEnabled = false;
        this._geometryChanged = new Event();
        this._showProperty = undefined;
        this._materialProperty = undefined;
        this._hasConstantOutline = true;
        this._showOutlineProperty = undefined;
        this._outlineColorProperty = undefined;
        this._options = new GeometryOptions(dynamicObject);
        this._onDynamicObjectPropertyChanged(dynamicObject, 'ellipsoid', dynamicObject.ellipsoid, undefined);
    };

    EllipsoidGeometryUpdater.PerInstanceColorAppearanceType = PerInstanceColorAppearance;

    EllipsoidGeometryUpdater.MaterialAppearanceType = MaterialAppearance;

    defineProperties(EllipsoidGeometryUpdater.prototype, {
        dynamicObject :{
            get : function() {
                return this._dynamicObject;
            }
        },
        fillEnabled : {
            get : function() {
                return this._fillEnabled;
            }
        },
        hasConstantFill : {
            get : function() {
                return !this._fillEnabled ||
                       (!defined(this._dynamicObject.availability) &&
                        (!defined(this._showProperty) || this._showProperty.isConstant) &&
                        (!defined(this._fillProperty) || this._fillProperty.isConstant));
            }
        },
        fillMaterialProperty : {
            get : function() {
                return this._materialProperty;
            }
        },
        outlineEnabled : {
            get : function() {
                return this._outlineEnabled;
            }
        },
        hasConstantOutline : {
            get : function() {
                return !this._outlineEnabled ||
                       (!defined(this._dynamicObject.availability) &&
                        (!defined(this._showProperty) || this._showProperty.isConstant) &&
                        (!defined(this._showOutlineProperty) || this._showOutlineProperty.isConstant));
            }
        },
        outlineColorProperty : {
            get : function() {
                return this._outlineColorProperty;
            }
        },
        isDynamic : {
            get : function() {
                return this._dynamic;
            }
        },
        isClosed : {
            get : function() {
                return true;
            }
        },
        geometryChanged : {
            get : function() {
                return this._geometryChanged;
            }
        }
    });

    EllipsoidGeometryUpdater.prototype.isOutlineVisible = function(time) {
        var dynamicObject = this._dynamicObject;
        return this._outlineEnabled && dynamicObject.isAvailable(time) && this._showProperty.getValue(time) && this._showOutlineProperty.getValue(time);
    };

    EllipsoidGeometryUpdater.prototype.isFilled = function(time) {
        var dynamicObject = this._dynamicObject;
        return this._fillEnabled && dynamicObject.isAvailable(time) && this._showProperty.getValue(time) && this._fillProperty.getValue(time);
    };

    EllipsoidGeometryUpdater.prototype.createFillGeometryInstance = function(time) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(time)) {
            throw new DeveloperError('time is required.');
        }

        if (!this._fillEnabled) {
            throw new DeveloperError('This instance does not represent a filled geometry.');
        }
        //>>includeEnd('debug');

        var dynamicObject = this._dynamicObject;
        var isAvailable = dynamicObject.isAvailable(time);

        var attributes;

        var color;
        var show = new ShowGeometryInstanceAttribute(isAvailable && this._showProperty.getValue(time) && this._fillProperty.getValue(time));
        if (this._materialProperty instanceof ColorMaterialProperty) {
            var currentColor = Color.WHITE;
            if (defined(defined(this._materialProperty.color)) && (this._materialProperty.color.isConstant || isAvailable)) {
                currentColor = this._materialProperty.color.getValue(time);
            }
            color = ColorGeometryInstanceAttribute.fromColor(currentColor);
            attributes = {
                show : show,
                color : color
            };
        } else {
            attributes = {
                show : show
            };
        }

        positionScratch = dynamicObject.position.getValue(Iso8601.MINIMUM_VALUE, positionScratch);
        orientationScratch = dynamicObject.orientation.getValue(Iso8601.MINIMUM_VALUE, orientationScratch);

        return new GeometryInstance({
            id : dynamicObject,
            geometry : new EllipsoidGeometry(this._options),
            modelMatrix : Matrix4.fromRotationTranslation(Matrix3.fromQuaternion(orientationScratch), positionScratch),
            attributes : attributes
        });
    };

    EllipsoidGeometryUpdater.prototype.createOutlineGeometryInstance = function(time) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(time)) {
            throw new DeveloperError('time is required.');
        }

        if (!this._outlineEnabled) {
            throw new DeveloperError('This instance does not represent an outlined geometry.');
        }
        //>>includeEnd('debug');

        var dynamicObject = this._dynamicObject;
        var isAvailable = dynamicObject.isAvailable(time);

        positionScratch = dynamicObject.position.getValue(Iso8601.MINIMUM_VALUE, positionScratch);
        orientationScratch = dynamicObject.orientation.getValue(Iso8601.MINIMUM_VALUE, orientationScratch);

        return new GeometryInstance({
            id : dynamicObject,
            geometry : new EllipsoidOutlineGeometry(this._options),
            modelMatrix : Matrix4.fromRotationTranslation(Matrix3.fromQuaternion(orientationScratch), positionScratch),
            attributes : {
                show : new ShowGeometryInstanceAttribute(isAvailable && this._showProperty.getValue(time) && this._showOutlineProperty.getValue(time)),
                color : ColorGeometryInstanceAttribute.fromColor(isAvailable ? this._outlineColorProperty.getValue(time) : Color.BLACK)
            }
        });
    };

    EllipsoidGeometryUpdater.prototype.isDestroyed = function() {
        return false;
    };

    EllipsoidGeometryUpdater.prototype.destroy = function() {
        this._dynamicObjectSubscription();
        destroyObject(this);
    };

    EllipsoidGeometryUpdater.prototype._onDynamicObjectPropertyChanged = function(dynamicObject, propertyName, newValue, oldValue) {
        if (!(propertyName === 'availability' || propertyName === 'position' || propertyName === 'orientation' || propertyName === 'ellipsoid')) {
            return;
        }

        var ellipsoid = this._dynamicObject.ellipsoid;

        if (!defined(ellipsoid)) {
            if (this._fillEnabled || this._outlineEnabled) {
                this._fillEnabled = false;
                this._outlineEnabled = false;
                this._geometryChanged.raiseEvent(this);
            }
            return;
        }

        var fillProperty = ellipsoid.fill;
        var fillEnabled = defined(fillProperty) && fillProperty.isConstant ? fillProperty.getValue(Iso8601.MINIMUM_VALUE) : true;

        var outlineProperty = ellipsoid.outline;
        var outlineEnabled = defined(outlineProperty);
        if (outlineEnabled && outlineProperty.isConstant) {
            outlineEnabled = outlineProperty.getValue(Iso8601.MINIMUM_VALUE);
        }

        if (!fillEnabled && !outlineEnabled) {
            if (this._fillEnabled || this._outlineEnabled) {
                this._fillEnabled = false;
                this._outlineEnabled = false;
                this._geometryChanged.raiseEvent(this);
            }
            return;
        }

        var position = this._dynamicObject.position;
        var orientation = this._dynamicObject.orientation;
        var radii = ellipsoid.radii;

        var show = ellipsoid.show;
        if ((defined(show) && show.isConstant && !show.getValue(Iso8601.MINIMUM_VALUE)) || //
            (!defined(position) || !defined(orientation) || !defined(radii))) {
            if (this._fillEnabled || this._outlineEnabled) {
                this._fillEnabled = false;
                this._outlineEnabled = false;
                this._geometryChanged.raiseEvent(this);
            }
            return;
        }

        var material = defaultValue(ellipsoid.material, defaultMaterial);
        var isColorMaterial = material instanceof ColorMaterialProperty;
        this._materialProperty = material;
        this._fillProperty = defaultValue(fillProperty, defaultFill);
        this._showProperty = defaultValue(show, defaultShow);
        this._showOutlineProperty = defaultValue(ellipsoid.outline, defaultOutline);
        this._outlineColorProperty = outlineEnabled ? defaultValue(ellipsoid.outlineColor, defaultOutlineColor) : undefined;
        this._fillEnabled = fillEnabled;
        this._outlineEnabled = outlineEnabled;

        var stackPartitions = ellipsoid.stackPartitions;
        var slicePartitions = ellipsoid.slicePartitions;
        var subdivisions = ellipsoid.subdivisions;

        if (!position.isConstant || //
            !orientation.isConstant || //
            !radii.isConstant || //
            defined(stackPartitions) && !stackPartitions.isConstant || //
            defined(slicePartitions) && !slicePartitions.isConstant || //
            defined(subdivisions) && !subdivisions.isConstant) {
            if (!this._dynamic) {
                this._dynamic = true;
                this._geometryChanged.raiseEvent(this);
            }
        } else {
            var options = this._options;
            options.vertexFormat = isColorMaterial ? PerInstanceColorAppearance.VERTEX_FORMAT : MaterialAppearance.VERTEX_FORMAT;
            options.radii = radii.getValue(Iso8601.MINIMUM_VALUE, options.radii);
            options.stackPartitions = defined(stackPartitions) ? stackPartitions.getValue(Iso8601.MINIMUM_VALUE) : undefined;
            options.slicePartitions = defined(slicePartitions) ? slicePartitions.getValue(Iso8601.MINIMUM_VALUE) : undefined;
            options.subdivisions = defined(subdivisions) ? subdivisions.getValue(Iso8601.MINIMUM_VALUE) : undefined;
            this._dynamic = false;
            this._geometryChanged.raiseEvent(this);
        }
    };

    EllipsoidGeometryUpdater.prototype.createDynamicUpdater = function(primitives) {
        //>>includeStart('debug', pragmas.debug);
        if (!this._dynamic) {
            throw new DeveloperError('This instance does not represent dynamic geometry.');
        }

        if (!defined(primitives)) {
            throw new DeveloperError('primitives is required.');
        }
        //>>includeEnd('debug');

        return new DynamicGeometryUpdater(primitives, this);
    };

    /**
     * @private
     */
    var DynamicGeometryUpdater = function(primitives, geometryUpdater) {
        this._dynamicObject = geometryUpdater._dynamicObject;
        this._primitives = primitives;
        this._primitive = undefined;
        this._outlinePrimitive = undefined;
        this._geometryUpdater = geometryUpdater;
        this._options = new GeometryOptions(geometryUpdater._dynamicObject);
        this._options.radii = new Cartesian3(1, 1, 1);
        this._modelMatrix = new Matrix4();
        this._material = undefined;
        this._attributes = undefined;
        this._outlineAttributes = undefined;
    };

    DynamicGeometryUpdater.prototype.update = function(time) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(time)) {
            throw new DeveloperError('time is required.');
        }
        //>>includeEnd('debug');

        var dynamicObject = this._dynamicObject;
        var ellipsoid = dynamicObject.ellipsoid;
        var show = ellipsoid.show;

        if (!dynamicObject.isAvailable(time) || (defined(show) && !show.getValue(time))) {
            if (defined(this._primitive)) {
                this._primitive.show = false;
            }

            if (defined(this._outlinePrimitive)) {
                this._outlinePrimitive.show = false;
            }
            return;
        }

        //Compute attributes and material.
        var appearance;
        var showFill = !defined(ellipsoid.fill) || ellipsoid.fill.getValue(time);
        var showOutline = defined(ellipsoid.outline) && ellipsoid.outline.getValue(time);
        var outlineColor = defined(ellipsoid.outlineColor) ? ellipsoid.outlineColor.getValue(time) : Color.BLACK;
        var material = MaterialProperty.getValue(time, defaultValue(ellipsoid.material, defaultMaterial), this._material);
        this._material = material;

        // Check properties that could trigger a primitive rebuild.
        var stackPartitionsProperty = ellipsoid.stackPartitions;
        var slicePartitionsProperty = ellipsoid.slicePartitions;
        var subdivisionsProperty = ellipsoid.subdivisions;
        var stackPartitions = defined(stackPartitionsProperty) ? stackPartitionsProperty.getValue(time) : undefined;
        var slicePartitions = defined(slicePartitionsProperty) ? slicePartitionsProperty.getValue(time) : undefined;
        var subdivisions = defined(subdivisionsProperty) ? subdivisionsProperty.getValue(time) : undefined;

        var options = this._options;

        //We only rebuild the primitive if something other than the radii has changed
        //For the radii, we use unit sphere and then deform it with a scale matrix.
        var rebuildPrimitives = !defined(this._primitive) || options.stackPartitions !== stackPartitions || options.slicePartitions !== slicePartitions || options.subdivisions !== subdivisions;
        if (rebuildPrimitives) {
            options.stackPartitions = stackPartitions;
            options.slicePartitions = slicePartitions;
            options.subdivisions = subdivisions;

            this._material = material;
            material = this._material;
            appearance = new MaterialAppearance({
                material : material,
                faceForward : true,
                translucent : material.isTranslucent(),
                closed : true
            });
            options.vertexFormat = appearance.vertexFormat;

            this._primitive = new Primitive({
                geometryInstances : new GeometryInstance({
                    id : dynamicObject,
                    geometry : new EllipsoidGeometry(options)
                }),
                appearance : appearance,
                asynchronous : false,
                attributes : {
                    show : new ShowGeometryInstanceAttribute(showFill)
                }
            });
            this._primitives.add(this._primitive);

            options.vertexFormat = PerInstanceColorAppearance.VERTEX_FORMAT;
            this._outlinePrimitive = new Primitive({
                geometryInstances : new GeometryInstance({
                    id : dynamicObject,
                    geometry : new EllipsoidOutlineGeometry(options),
                    attributes : {
                        show : new ShowGeometryInstanceAttribute(showOutline),
                        color : ColorGeometryInstanceAttribute.fromColor(outlineColor)
                    }
                }),
                appearance : new PerInstanceColorAppearance({
                    flat : true,
                    translucent : outlineColor.alpha !== 1.0
                }),
                asynchronous : false
            });
            this._primitives.add(this._outlinePrimitive);

        } else {
            //Update attributes only.
            var primitive = this._primitive;
            appearance = primitive.appearance;
            appearance.material = material;

            var attributes = this._attributes;
            if (!defined(attributes)) {
                attributes = primitive.getGeometryInstanceAttributes(dynamicObject);
                this._attributes = attributes;
            }
            attributes.show = ShowGeometryInstanceAttribute.toValue(showFill, attributes.show);

            var outlinePrimitive = this._outlinePrimitive;

            var outlineAttributes = this._outlineAttributes;
            if (!defined(outlineAttributes)) {
                outlineAttributes = outlinePrimitive.getGeometryInstanceAttributes(dynamicObject);
                this._outlineAttributes = outlineAttributes;
            }
            outlineAttributes.show = ShowGeometryInstanceAttribute.toValue(showOutline, outlineAttributes.show);
            outlineAttributes.color = ColorGeometryInstanceAttribute.toValue(outlineColor, outlineAttributes.color);
        }

        //Finally, compute and set the model matrices
        var positionProperty = dynamicObject.position;
        var orientationProperty = dynamicObject.orientation;
        var radiiProperty = ellipsoid.radii;

        positionScratch = positionProperty.getValue(time, positionScratch);
        orientationScratch = orientationProperty.getValue(time, orientationScratch);
        matrix3Scratch = Matrix3.fromQuaternion(orientationScratch, matrix3Scratch);
        radiiScratch = radiiProperty.getValue(time, radiiScratch);

        var modelMatrix = this._modelMatrix;
        modelMatrix = Matrix4.fromRotationTranslation(matrix3Scratch, positionScratch, modelMatrix);
        modelMatrix = Matrix4.multiplyByScale(modelMatrix, radiiScratch, modelMatrix);
        this._primitive.modelMatrix = modelMatrix;
        this._outlinePrimitive.modelMatrix = modelMatrix;
    };

    DynamicGeometryUpdater.prototype.isDestroyed = function() {
        return false;
    };

    DynamicGeometryUpdater.prototype.destroy = function() {
        if (defined(this._primitive)) {
            this._primitives.remove(this._primitive);
        }

        if (defined(this._outlinePrimitive)) {
            this._primitives.remove(this._outlinePrimitive);
        }
        destroyObject(this);
    };

    return EllipsoidGeometryUpdater;
});