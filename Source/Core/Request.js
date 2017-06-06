/*global define*/
define([
        './defaultValue',
        './defined',
        './defineProperties',
        './RequestState',
        './RequestType'
    ], function(
        defaultValue,
        defined,
        defineProperties,
        RequestState,
        RequestType) {
    'use strict';

    /**
     * Stores information for making a request. In general this does not need to be constructed directly.
     *
     * @alias Request
     * @constructor
     *
     * @param {Object} [options] An object with the following properties:
     * @param {Boolean} [options.url] The url to request.
     * @param {Function} [options.requestFunction] The actual function that makes the request. The function takes no arguments and returns a promise for the requested data.
     * @param {Function} [options.cancelFunction] Function to call when a request is cancelled. The function takes no arguments.
     * @param {Function} [options.priorityFunction] Function that is called when the request is updated. The function takes no arguments and returns the updated priority value.
     * @param {Number} [options.priority=0.0] The initial priority of the request.
     * @param {Boolean} [options.throttle=false] Whether to throttle and prioritize the request. If false, the request will be sent immediately. If true, the request will be throttled and sent based on priority.
     * @param {Boolean} [options.throttleByServer=false] Whether to throttle the request by server.
     * @param {RequestType} [options.type=RequestType.OTHER] The type of request.
     */
    function Request(options) {
        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

        var throttleByServer = defaultValue(options.throttleByServer, false);
        var throttle = throttleByServer || defaultValue(options.throttle, false);

        /**
         * The URL to request.
         *
         * @type {String}
         */
        this.url = options.url;

        /**
         * The actual function that makes the request. The function takes no arguments and returns a promise for the requested data.
         *
         * @type {Function}
         */
        this.requestFunction = options.requestFunction;

        /**
         * Function to call when a request is cancelled. The function takes no arguments.
         *
         * @type {Function}
         */
        this.cancelFunction = options.cancelFunction;

        /**
         * Function that is called when the request is updated. The function takes no arguments and returns the updated priority value.
         *
         * @type {Function}
         */
        this.priorityFunction = options.priorityFunction;

        /**
         * Priority is a unit-less value where lower values represent higher priority.
         * For world-based objects, this is usually the distance from the camera.
         * A request that does not have a priority function defaults to a priority of 0.
         *
         * If priorityFunction is defined, this value is updated every frame with the result of that call.
         *
         * @type {Number}
         * @default 0.0
         */
        this.priority = defaultValue(options.priority, 0.0);

        /**
         * Whether to throttle and prioritize the request. If false, the request will be sent immediately. If true, the
         * request will be throttled and sent based on priority.
         *
         * @type {Boolean}
         * @readonly
         *
         * @default false
         */
        this.throttle = throttle;

        /**
         * Whether to throttle the request by server. Browsers typically support about 6-8 parallel connections
         * for HTTP/1 servers, and an unlimited amount of connections for HTTP/2 servers. Setting this value
         * to <code>true</code> is preferable for requests going through HTTP/1 servers.
         *
         * @type {Boolean}
         * @readonly
         *
         * @default false
         */
        this.throttleByServer = throttleByServer;

        /**
         * Type of request.
         *
         * @type {RequestType}
         * @readonly
         *
         * @default RequestType.OTHER
         */
        this.type = defaultValue(options.type, RequestType.OTHER);

        /**
         * A key used to identify the server that a request is going to. It is derived from the url's authority and scheme.
         *
         * @type {String}
         *
         * @private
         */
        this.serverKey = undefined;

        /**
         * The current state of the request.
         *
         * @type {RequestState}
         * @readonly
         */
        this.state = RequestState.UNISSUED;

        /**
         * The requests's deferred promise.
         *
         * @type {Object}
         *
         * @private
         */
        this.deferred = undefined;

        /**
         * Whether the request was explicitly cancelled.
         *
         * @type {Boolean}
         *
         * @private
         */
        this.cancelled = false;
    }

    /**
     * Mark the request as cancelled.
     *
     * @private
     */
    Request.prototype.cancel = function() {
        this.cancelled = true;
    };

    return Request;
});
