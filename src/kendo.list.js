(function(f, define){
    define([ "./kendo.data", "./kendo.popup" ], f);
})(function(){

var __meta__ = {
    id: "list",
    name: "List",
    category: "framework",
    depends: [ "data", "popup" ],
    hidden: true
};

(function($, undefined) {
    var kendo = window.kendo,
        ui = kendo.ui,
        Widget = ui.Widget,
        keys = kendo.keys,
        support = kendo.support,
        htmlEncode = kendo.htmlEncode,
        activeElement = kendo._activeElement,
        ID = "id",
        LI = "li",
        CHANGE = "change",
        CHARACTER = "character",
        FOCUSED = "k-state-focused",
        HOVER = "k-state-hover",
        LOADING = "k-loading",
        OPEN = "open",
        CLOSE = "close",
        SELECT = "select",
        SELECTED = "selected",
        PROGRESS = "progress",
        REQUESTEND = "requestEnd",
        WIDTH = "width",
        extend = $.extend,
        proxy = $.proxy,
        browser = support.browser,
        isIE8 = browser.msie && browser.version < 9,
        quotRegExp = /"/g,
        alternativeNames = {
            "ComboBox": "DropDownList",
            "DropDownList": "ComboBox"
        };

    var List = kendo.ui.DataBoundWidget.extend({
        init: function(element, options) {
            var that = this,
                ns = that.ns,
                id;

            Widget.fn.init.call(that, element, options);
            element = that.element;

            that._isSelect = element.is(SELECT);

            if (that._isSelect && that.element[0].length) {
                if (!options.dataSource) {
                    options.dataTextField = options.dataTextField || "text";
                    options.dataValueField = options.dataValueField || "value";
                }
            }

            that.ul = $('<ul unselectable="on" class="k-list k-reset"/>')
                        .attr({
                            tabIndex: -1,
                            "aria-hidden": true
                        });

            that.list = $("<div class='k-list-container'/>")
                        .append(that.ul)
                        .on("mousedown" + ns, proxy(that._listMousedown, that));

            //find a better name
            var listView;

            if (options.virtual) {
                listView = new kendo.ui.VirtualList(that.ul, {});
            } else {
                listView = new StaticList(that.ul, {
                    template: "#:" + kendo.expr(options.dataTextField, "data") + "#",
                    groupTemplate: "#:data#"
                });
            }

            that.listView = listView;

            id = element.attr(ID);

            if (id) {
                that.list.attr(ID, id + "-list");
                that.ul.attr(ID, id + "_listbox");
            }

            that._header();
            that._accessors();
            that._initValue();
        },

        options: {
            valuePrimitive: false,
            headerTemplate: ""
        },

        setOptions: function(options) {
            Widget.fn.setOptions.call(this, options);

            if (options && options.enable !== undefined) {
                options.enabled = options.enable;
            }
        },

        focus: function() {
            this._focused.focus();
        },

        readonly: function(readonly) {
            this._editable({
                readonly: readonly === undefined ? true : readonly,
                disable: false
            });
        },

        enable: function(enable) {
            this._editable({
                readonly: false,
                disable: !(enable = enable === undefined ? true : enable)
            });
        },

        _listMousedown: function(e) {
            if (!this.filterInput || this.filterInput[0] !== e.target) {
                e.preventDefault();
            }
        },

        _filterSource: function(filter, force) {
            var that = this;
            var options = that.options;
            var dataSource = that.dataSource;
            var expression = extend({}, dataSource.filter() || {});

            var removed = removeFiltersForField(expression, options.dataTextField);

            if ((filter || removed) && that.trigger("filtering", { filter: filter })) {
                return;
            }

            if (filter) {
                expression = expression.filters || [];
                expression.push(filter);
            }

            if (!force) {
                dataSource.filter(expression);
            } else {
                dataSource.read(expression);
            }
        },

        _header: function() {
            var that = this;
            var template = that.options.headerTemplate;
            var header;

            if ($.isFunction(template)) {
                template = template({});
            }

            if (template) {
                that.list.prepend(template);

                header = that.ul.prev();

                that.header = header[0] ? header : null;
                if (that.header) {
                    that.angular("compile", function(){
                        return { elements: that.header };
                    });
                }
            }
        },

        _initValue: function() {
            var that = this,
                value = that.options.value;

            if (value !== null) {
                that.element.val(value);
            } else {
                value = that._accessor();
                that.options.value = value;
            }

            that._old = value;
        },

        _ignoreCase: function() {
            var that = this,
                model = that.dataSource.reader.model,
                field;

            if (model && model.fields) {
                field = model.fields[that.options.dataTextField];

                if (field && field.type && field.type !== "string") {
                    that.options.ignoreCase = false;
                }
            }
        },

        items: function() {
            return this.ul[0].children;
        },

        //TODO: move widget specific logic into event "focus"
        /*current: function(candidate) {
            var that = this;
            var focused = that._focused.add(that.filterInput);
            var id = that._optionID;

            if (candidate !== undefined) {
                if (that._current) {
                    that._current
                        .removeClass(FOCUSED)
                        .removeAttr("aria-selected")
                        .removeAttr(ID);

                    focused.removeAttr("aria-activedescendant");
                }

                if (candidate) {
                    candidate.addClass(FOCUSED);
                    that._scroll(candidate);

                    if (id) {
                        candidate.attr("id", id);
                        focused.attr("aria-activedescendant", id);
                    }
                }

                that._current = candidate;
            } else {
                return that._current;
            }
        },*/

        destroy: function() {
            var that = this,
                ns = that.ns;

            Widget.fn.destroy.call(that);

            that._unbindDataSource();

            //destroy the static/virtual list here
            //that.ul.off(ns);
            that.list.off(ns);

            if (that._touchScroller) {
                that._touchScroller.destroy();
            }

            that.popup.destroy();

            if (that._form) {
                that._form.off("reset", that._resetHandler);
            }
        },

        dataItem: function(index) {
            var that = this;


            if (index === undefined) {
                index = that.selectedIndex;
            } else if (typeof index !== "number") {
                index = $(that.items()).index(index);
            }

            return that._data()[index];
        },

        _accessors: function() {
            var that = this;
            var element = that.element;
            var options = that.options;
            var getter = kendo.getter;
            var textField = element.attr(kendo.attr("text-field"));
            var valueField = element.attr(kendo.attr("value-field"));

            if (!options.dataTextField && textField) {
                options.dataTextField = textField;
            }

            if (!options.dataValueField && valueField) {
                options.dataValueField = valueField;
            }

            that._text = getter(options.dataTextField);
            that._value = getter(options.dataValueField);
        },

        _aria: function(id) {
            var that = this,
                options = that.options,
                element = that._focused.add(that.filterInput);

            if (options.suggest !== undefined) {
                element.attr("aria-autocomplete", options.suggest ? "both" : "list");
            }

            id = id ? id + " " + that.ul[0].id : that.ul[0].id;

            element.attr("aria-owns", id);

            that.ul.attr("aria-live", !options.filter || options.filter === "none" ? "off" : "polite");
        },

        //TODO: this should go into list "change|select" event
        _blur: function() {
            var that = this;

            that._change();
            that.close();
        },

        _change: function() {
            var that = this,
                index = that.selectedIndex,
                optionValue = that.options.value,
                value = that.value(),
                trigger;

            if (that._isSelect && !that._bound && optionValue) {
                value = optionValue;
            }

            if (value !== that._old) {
                trigger = true;
            } else if (index !== undefined && index !== that._oldIndex) {
                trigger = true;
            }

            if (trigger) {
                that._old = value;
                that._oldIndex = index;

                // trigger the DOM change event so any subscriber gets notified
                that.element.trigger(CHANGE);

                that.trigger(CHANGE);
            }
        },

        _data: function() {
            return this.dataSource.view();
        },

        _enable: function() {
            var that = this,
                options = that.options,
                disabled = that.element.is("[disabled]");

            if (options.enable !== undefined) {
                options.enabled = options.enable;
            }

            if (!options.enabled || disabled) {
                that.enable(false);
            } else {
                that.readonly(that.element.is("[readonly]"));
            }
        },

        //TODO: Move this logic in to list "focus" event
        /*_focus: function(li) {
            var that = this;
            var userTriggered = true;

            if (that.popup.visible() && li && that.trigger(SELECT, {item: li})) {
                that.close();
                return;
            }

            that._select(li);
            that._triggerCascade(userTriggered);

            that._blur();
        },*/

        _index: function(value) {
            var that = this,
                idx,
                length,
                data = that._data();

            for (idx = 0, length = data.length; idx < length; idx++) {
                if (that._dataValue(data[idx]) == value) {
                    return idx;
                }
            }

            return -1;
        },

        _dataValue: function(dataItem) {
            var value = this._value(dataItem);

            if (value === undefined) {
                value = this._text(dataItem);
            }

            return value;
        },

        //TODO: find a correct way to calculate height of the ul element!
        _height: function(length) {
            if (length) {
                var that = this,
                    list = that.list,
                    height = that.options.height,
                    visible = that.popup.visible(),
                    offsetTop,
                    popups;

                popups = list.add(list.parent(".k-animation-container")).show();

                height = that.ul[0].scrollHeight > height ? height : "auto";

                popups.height(height);

                if (height !== "auto") {
                    offsetTop = that.ul[0].offsetTop;

                    if (offsetTop) {
                        height = list.height() - offsetTop;
                    }
                }

                that.ul.height(height);

                if (!visible) {
                    popups.hide();
                }
            }
        },

        _adjustListWidth: function() {
            var list = this.list,
                width = list[0].style.width,
                wrapper = this.wrapper,
                computedStyle, computedWidth;

            if (!list.data(WIDTH) && width) {
                return;
            }

            computedStyle = window.getComputedStyle ? window.getComputedStyle(wrapper[0], null) : 0;
            computedWidth = computedStyle ? parseFloat(computedStyle.width) : wrapper.outerWidth();

            if (computedStyle && browser.msie) { // getComputedStyle returns different box in IE.
                computedWidth += parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight) + parseFloat(computedStyle.borderLeftWidth) + parseFloat(computedStyle.borderRightWidth);
            }

            if (list.css("box-sizing") !== "border-box") {
                width = computedWidth - (list.outerWidth() - list.width());
            } else {
                width = computedWidth;
            }

            list.css({
                fontFamily: wrapper.css("font-family"),
                width: width
            })
            .data(WIDTH, width);

            return true;
        },

        _openHandler: function(e) {
            this._adjustListWidth();

            if (this.trigger(OPEN)) {
                e.preventDefault();
            } else {
                this._focused.attr("aria-expanded", true);
                this.ul.attr("aria-hidden", false);
            }
        },

        _closeHandler: function(e) {
            if (this.trigger(CLOSE)) {
                e.preventDefault();
            } else {
                this._focused.attr("aria-expanded", false);
                this.ul.attr("aria-hidden", true);
            }
        },

        _firstOpen: function() {
            this._height(this._data().length);
        },

        _popup: function() {
            var that = this;

            that.popup = new ui.Popup(that.list, extend({}, that.options.popup, {
                anchor: that.wrapper,
                open: proxy(that._openHandler, that),
                close: proxy(that._closeHandler, that),
                animation: that.options.animation,
                isRtl: support.isRtl(that.wrapper)
            }));

            //that.popup.one(OPEN, proxy(that._firstOpen, that));
            that._touchScroller = kendo.touchScroller(that.popup.element);
        },

        //TODO: This should be done on every update of VirtualList
        _makeUnselectable: function() {
            if (isIE8) {
                this.list.find("*").not(".k-textbox").attr("unselectable", "on");
            }
        },

        _toggleHover: function(e) {
            $(e.currentTarget).toggleClass(HOVER, e.type === "mouseenter");
        },

        _toggle: function(open, preventFocus) {
            var that = this;
            var touchEnabled = support.touch && support.MSPointers && support.pointers;

            open = open !== undefined? open : !that.popup.visible();

            if (!preventFocus && !touchEnabled && that._focused[0] !== activeElement()) {
                that._focused.focus();
            }

            that[open ? OPEN : CLOSE]();
        },

        _triggerCascade: function(userTriggered) {
            var that = this,
                value = that.value();

            if ((!that._bound && value) || that._old !== value) {
                that.trigger("cascade", { userTriggered: userTriggered });
            }
        },

        _unbindDataSource: function() {
            var that = this;

            that.dataSource.unbind(CHANGE, that._refreshHandler)
                           .unbind(PROGRESS, that._progressHandler)
                           .unbind(REQUESTEND, that._requestEndHandler)
                           .unbind("error", that._errorHandler);
        }
    });

    extend(List, {
        inArray: function(node, parentNode) {
            var idx, length, siblings = parentNode.children;

            if (!node || node.parentNode !== parentNode) {
                return -1;
            }

            for (idx = 0, length = siblings.length; idx < length; idx++) {
                if (node === siblings[idx]) {
                    return idx;
                }
            }

            return -1;
        }
    });

    kendo.ui.List = List;

    //Could we remove the SELECT list from here!!!
    ui.Select = List.extend({
        init: function(element, options) {
            List.fn.init.call(this, element, options);
            this._initial = this.element.val();
        },

        setDataSource: function(dataSource) {
            this.options.dataSource = dataSource;

            this._dataSource();
            this._bound = false;

            if (this.options.autoBind) {
                this.dataSource.fetch();
            }
        },

        close: function() {
            this.popup.close();
        },

        select: function(li) {
            var that = this;

            if (li === undefined) {
                return that.selectedIndex;
            } else {
                /////
                li = that._get(li);
                that.listView.select(li);
                that.selectedIndex = that.listView.selectedIndex;
                //that._select(li);
                //

                that._triggerCascade();
                that._old = that._accessor();
                that._oldIndex = that.selectedIndex;
            }
        },

        search: function(word) {
            word = typeof word === "string" ? word : this.text();
            var that = this;
            var length = word.length;
            var options = that.options;
            var ignoreCase = options.ignoreCase;
            var filter = options.filter;
            var field = options.dataTextField;

            clearTimeout(that._typing);

            if (!length || length >= options.minLength) {
                that._state = "filter";
                if (filter === "none") {
                    that._filter(word);
                } else {
                    that._open = true;
                    that._filterSource({
                        value: ignoreCase ? word.toLowerCase() : word,
                        field: field,
                        operator: filter,
                        ignoreCase: ignoreCase
                    });
                }
            }
        },

        _accessor: function(value, idx) {
            var element = this.element[0],
                isSelect = this._isSelect,
                selectedIndex = element.selectedIndex,
                option;

            if (value === undefined) {
                if (isSelect) {
                    if (selectedIndex > -1) {
                        option = element.options[selectedIndex];

                        if (option) {
                            value = option.value;
                        }
                    }
                } else {
                    value = element.value;
                }
                return value;
            } else {
                if (isSelect) {
                    if (selectedIndex > -1) {
                        element.options[selectedIndex].removeAttribute(SELECTED);
                    }

                    element.selectedIndex = idx;
                    option = element.options[idx];
                    if (option) {
                       option.setAttribute(SELECTED, SELECTED);
                    }
                } else {
                    element.value = value;
                }
            }
        },

        _hideBusy: function () {
            var that = this;
            clearTimeout(that._busy);
            that._arrow.removeClass(LOADING);
            that._focused.attr("aria-busy", false);
            that._busy = null;
        },

        _showBusy: function () {
            var that = this;

            that._request = true;

            if (that._busy) {
                return;
            }

            that._busy = setTimeout(function () {
                if (that._arrow) { //destroyed after request start
                    that._focused.attr("aria-busy", true);
                    that._arrow.addClass(LOADING);
                }
            }, 100);
        },

        _requestEnd: function() {
            this._request = false;
        },

        _dataSource: function() {
            var that = this,
                element = that.element,
                options = that.options,
                dataSource = options.dataSource || {},
                idx;

            dataSource = $.isArray(dataSource) ? {data: dataSource} : dataSource;

            if (that._isSelect) {
                idx = element[0].selectedIndex;
                if (idx > -1) {
                    options.index = idx;
                }

                dataSource.select = element;
                dataSource.fields = [{ field: options.dataTextField },
                                     { field: options.dataValueField }];
            }

            if (that.dataSource && that._refreshHandler) {
                that._unbindDataSource();
            } else {
                that._progressHandler = proxy(that._showBusy, that);
                that._requestEndHandler = proxy(that._requestEnd, that);
                that._errorHandler = proxy(that._hideBusy, that);
            }

            that.dataSource = kendo.data.DataSource.create(dataSource)
                                   .bind(PROGRESS, that._progressHandler)
                                   .bind(REQUESTEND, that._requestEndHandler)
                                   .bind("error", that._errorHandler);

            that.listView.setOptions({
                dataSource: that.dataSource
            });
        },

        _get: function(li) {
            var that = this,
                data = that._data(),
                idx, length;

            if (typeof li === "function") {
                for (idx = 0, length = data.length; idx < length; idx++) {
                    if (li(data[idx])) {
                        li = idx;
                        break;
                    }
                }
            }

            if (typeof li === "number") {
                if (li < 0) {
                    return $();
                }

                li = $(that.ul[0].children[li]);
            }

            if (li && li.nodeType) {
                li = $(li);
            }

            return li;
        },

        //TODO: move to the StaticList - use new API!
        /*
        _move: function(e) {
            var that = this,
                key = e.keyCode,
                ul = that.ul[0],
                methodName = that.popup.visible() ? "_select" : "_accept",
                current = that._current,
                down = key === keys.DOWN,
                firstChild,
                pressed;

            if (key === keys.UP || down) {
                if (e.altKey) {
                    that.toggle(down);
                } else {
                    firstChild = ul.firstChild;
                    if (!firstChild && !that._accessor() && that._state !== "filter") {
                        if (!that._fetch) {
                            that.dataSource.one(CHANGE, function() {
                                that._move(e);
                                that._fetch = false;
                            });

                            that._fetch = true;
                            that._filterSource();
                        }

                        e.preventDefault();

                        return true; //pressed
                    }

                    if (down) {
                        if (!current || (that.selectedIndex === -1 && !that.value() && current[0] === firstChild)) {
                            current = firstChild;
                        } else {
                            current = current[0].nextSibling;
                            if (!current && firstChild === ul.lastChild) {
                                current = firstChild;
                            }
                        }

                        that[methodName](current);
                    } else {
                        current = current ? current[0].previousSibling : ul.lastChild;
                        if (!current && firstChild === ul.lastChild) {
                            current = firstChild;
                        }

                        that[methodName](current);
                    }
                }

                e.preventDefault();
                pressed = true;
            } else if (key === keys.ENTER || key === keys.TAB) {
                if (that.popup.visible()) {
                    e.preventDefault();
                }

                if (!that.popup.visible() && (!current || !current.hasClass("k-state-selected"))) {
                    current = null;
                }

                that._accept(current, key);
                pressed = true;
            } else if (key === keys.ESC) {
                if (that.popup.visible()) {
                    e.preventDefault();
                }
                that.close();
                pressed = true;
            }

            return pressed;
        },
        */

        _selectItem: function() {
            var that = this,
                notBound = that._bound === undefined,
                options = that.options,
                useOptionIndex,
                value;

            useOptionIndex = that._isSelect && !that._initial && !options.value && options.index && !that._bound;

            if (!useOptionIndex) {
                value = that._selectedValue || (notBound && options.value) || that._accessor();
            }

            if (value) {
                that.value(value);
            } else if (notBound) {
                that.select(options.index);
            }
        },

        _fetchItems: function(value) {
            var that = this,
                hasItems = that.ul[0].firstChild;

            //if request is started avoid datasource.fetch
            if (that._request) {
                return true;
            }

            if (!that._bound && !that._fetch && !hasItems) {
                if (that.options.cascadeFrom) {
                    return !hasItems;
                }

                that.dataSource.one(CHANGE, function() {
                    that._old = undefined;
                    that.value(value);
                    that._fetch = false;
                });

                that._fetch = true;
                that.dataSource.fetch();

                return true;
            }
        },

        //TODO: Call this in Static/Virtual List "listBound" event
        _options: function(data, optionLabel) {
            var that = this,
                element = that.element,
                length = data.length,
                options = "",
                option,
                dataItem,
                dataText,
                dataValue,
                idx = 0;

            if (optionLabel) {
                idx = 1;
                options = optionLabel;
            }

            for (; idx < length; idx++) {
                option = "<option";
                dataItem = data[idx];
                dataText = that._text(dataItem);
                dataValue = that._value(dataItem);

                if (dataValue !== undefined) {
                    dataValue += "";

                    if (dataValue.indexOf('"') !== -1) {
                        dataValue = dataValue.replace(quotRegExp, "&quot;");
                    }

                    option += ' value="' + dataValue + '"';
                }

                option += ">";

                if (dataText !== undefined) {
                    option += htmlEncode(dataText);
                }

                option += "</option>";
                options += option;
            }

            element.html(options);
        },

        _reset: function() {
            var that = this,
                element = that.element,
                formId = element.attr("form"),
                form = formId ? $("#" + formId) : element.closest("form");

            if (form[0]) {
                that._resetHandler = function() {
                    setTimeout(function() {
                        that.value(that._initial);
                    });
                };

                that._form = form.on("reset", that._resetHandler);
            }
        },

        //TODO: Refactor
        _cascade: function() {
            var that = this,
                options = that.options,
                cascade = options.cascadeFrom,
                parent, parentElement,
                select, valueField,
                change;

            if (cascade) {
                that._selectedValue = options.value || that._accessor();

                parentElement = $("#" + cascade);
                parent = parentElement.data("kendo" + options.name);

                if (!parent) {
                    parent = parentElement.data("kendo" + alternativeNames[options.name]);
                }

                if (!parent) {
                    return;
                }

                options.autoBind = false;
                valueField = options.cascadeFromField || parent.options.dataValueField;

                change = function() {
                    that.dataSource.unbind(CHANGE, change);

                    var value = that._selectedValue || that.value();
                    if (that._userTriggered) {
                        that._clearSelection(parent, true);
                    } else if (value) {
                        that.value(value);
                        if (!that.dataSource.view()[0] || that.selectedIndex === -1) {
                            that._clearSelection(parent, true);
                        }
                    } else {
                        that.select(options.index);
                    }

                    that.enable();
                    that._triggerCascade(that._userTriggered);
                    that._userTriggered = false;
                };
                select = function() {
                    var dataItem = parent.dataItem(),
                        filterValue = dataItem ? parent._value(dataItem) : null,
                        expressions, filters;

                    if (filterValue || filterValue === 0) {
                        expressions = that.dataSource.filter() || {};
                        removeFiltersForField(expressions, valueField);
                        filters = expressions.filters || [];

                        filters.push({
                            field: valueField,
                            operator: "eq",
                            value: filterValue
                        });

                        var handler = function() {
                            that.unbind("dataBound", handler);
                            change.apply(that, arguments);
                        };

                        that.first("dataBound", handler);

                        that.dataSource.filter(filters);

                    } else {
                        that.enable(false);
                        that._clearSelection(parent);
                        that._triggerCascade(that._userTriggered);
                        that._userTriggered = false;
                    }
                };

                parent.first("cascade", function(e) {
                    that._userTriggered = e.userTriggered;
                    select();
                });

                //refresh was called
                if (parent._bound) {
                    select();
                } else if (!parent.value()) {
                    that.enable(false);
                }
            }
        }
    });

    var STATIC_LIST_NS = ".StaticList";

    var StaticList = kendo.ui.DataBoundWidget.extend({
        init: function(element, options) {
            Widget.fn.init.call(this, element, options);

            this.element.attr("role", "listbox")
                        .css({ overflow: support.kineticScrollNeeded ? "": "auto" })
                        .on("mouseenter" + STATIC_LIST_NS, "li", function() { $(this).addClass(HOVER); })
                        .on("mouseleave" + STATIC_LIST_NS, "li", function() { $(this).removeClass(HOVER); })
                        .on("click" + STATIC_LIST_NS, "li", proxy(this._click, this));

            this.setDataSource(this.options.dataSource);

            this._optionID = kendo.guid();
            this._selectedItems = [];
            this._values = [];

            this._getter();
            this._templates();

            var value = this.options.value;
            if (value) {
                this._values = $.isArray(value) ? value.slice(0) : [value];
            }
        },

        _getter: function() {
            this._valueGetter = kendo.getter(this.options.dataValueField);
        },

        _find: function(dataItem, values) {
            var getter = this._valueGetter;
            var value = getter(dataItem);
            var found = false;

            for (var idx = 0; idx < values.length; idx++) {
                if (value == values[idx]) {
                    values.splice(idx, 1);
                    found = true;
                    break;
                }
            }

            return found;
        },

        options: {
            dataValueField: null,
            name: "StaticList",
            selectable: "multiple", //true, //true|false|multiple
            template: null
        },

        events: [
           "focus",
           "change",
           "listBound"
        ],

        setDataSource: function(source) {
            var that = this;
            var dataSource = source || {};

            dataSource = $.isArray(dataSource) ? { data: dataSource } : dataSource;
            dataSource = kendo.data.DataSource.create(dataSource);

            if (that._refreshHandler) {
                dataSource.unbind(CHANGE, that._refreshHandler);
            } else {
                that._refreshHandler = proxy(that.refresh, that);
            }

            that.dataSource = dataSource.bind(CHANGE, that._refreshHandler);
        },

        //Test this
        setOptions: function(options) {
            Widget.fn.setOptions.call(this, options);

            if (options.dataSource) {
                this.setDataSource(options.dataSource);
            }

            this._templates();
        },

        _click: function(e) {
            if (!e.isDefaultPrevented()) {

                this.focus($(e.currentTarget));
                this.select(this.current());
            }
        },

        current: function(candidate) {
            var that = this;
            var id = that._optionID;

            if (candidate !== undefined) {
                if (that._current) {
                    that._current
                        .removeClass(FOCUSED)
                        .removeAttr("aria-selected")
                        .removeAttr(ID);
                }

                if (candidate) {
                    candidate.addClass(FOCUSED);
                    that.scroll(candidate);

                    if (id) {
                        candidate.attr("id", id);
                    }
                }

                that._current = candidate;
            } else {
                return that._current;
            }
        },

        scroll: function (item) {
            if (!item) {
                return;
            }

            if (item[0]) {
                item = item[0];
            }

            var ul = this.element[0],
                itemOffsetTop = item.offsetTop,
                itemOffsetHeight = item.offsetHeight,
                ulScrollTop = ul.scrollTop,
                ulOffsetHeight = ul.clientHeight,
                bottomDistance = itemOffsetTop + itemOffsetHeight,
                touchScroller = this._touchScroller,
                yDimension, offsetHeight;

            if (touchScroller) {
                yDimension = touchScroller.dimensions.y;

                if (yDimension.enabled && itemOffsetTop > yDimension.size) {
                    itemOffsetTop = itemOffsetTop - yDimension.size + itemOffsetHeight + 4;

                    touchScroller.scrollTo(0, -itemOffsetTop);
                }
            } else {
                offsetHeight = this.header ? this.header.outerHeight() : 0;
                offsetHeight += this.filterInput ? this.filterInput.outerHeight() : 0;

                ul.scrollTop = ulScrollTop > itemOffsetTop ?
                               (itemOffsetTop - offsetHeight) : bottomDistance > (ulScrollTop + ulOffsetHeight) ?
                               (bottomDistance - ulOffsetHeight - offsetHeight) : ulScrollTop;
            }
        },

        //should work with index!
        focus: function(li) {
            if (this.trigger("focus", {item: li})) {
                return;
            }

            this.current(li);
        },

        //should work with indexes; select bulk of indexes
        //
        //1: keep selected DOM elements. Thus we can de-select them based on selectable option
        //
        select: function(li) {
            var that = this;
            var idx;

            if (li && li[0]) {
                if (this._deselect(li.hasClass("k-state-selected") ? li : null)) {
                    return;
                }

                idx = inArray(li[0], that.element[0]);
                that.selectedIndex = idx;

                if (idx > -1) {
                    if (li !== that._current) {
                        that.current(li);
                    }

                    li.addClass("k-state-selected").attr("aria-selected", true);

                    this._selectedItems.push(li);
                } else { //support for -1
                    that.current(null);
                }

                this.trigger("select"); //Could be 'change' ???
            }
        },

        _deselect: function(element) {
            var selectedItems = this._selectedItems;
            var selectable = this.options.selectable;

            // single selection
            if (selectable === true) {
                for (var idx = 0; idx < selectedItems.length; idx++) {
                    selectedItems[idx].removeClass("k-state-selected");
                }

                this._selectedItems = [];
            } else if (selectable === "multiple" && element) {
                for (var idx = 0; idx < selectedItems.length; idx++) {
                    if (selectedItems[idx][0] === element[0]) {
                        selectedItems[idx].removeClass("k-state-selected");
                        selectedItems.splice(idx, 1);
                        break;
                    }
                }

                return true;
            }
        },

        _template: function() {
            var that = this;
            var options = that.options;
            var template = options.template;

            if (!template) {
                template = kendo.template('<li tabindex="-1" role="option" unselectable="on" class="k-item">${' + kendo.expr(options.dataTextField, "data") + "}</li>", { useWithBlock: false });
            } else {
                template = kendo.template(template);
                template = function(data) {
                    return '<li tabindex="-1" role="option" unselectable="on" class="k-item">' + template(data) + "</li>";
                };
            }

            return template;
        },

        _templates: function() {
            var template;
            var templates = {
                template: this.options.template,
                groupTemplate: this.options.groupTemplate,
                fixedGroupTemplate: this.options.fixedGroupTemplate
            };

            for (var key in templates) {
                template = templates[key];
                if (template && typeof template !== "function") {
                    templates[key] = kendo.template(template);
                }
            }

            this.templates = templates;
        },

        _renderItem: function(context, values) {
            var item = '<li tabindex="-1" role="option" unselectable="on" class="k-item';
            var found = this._find(context.item, values);

            item += found ? ' k-state-selected"' : '"';

            item += ' data-index="' + context.index + '">';
            item += this.templates.template(context.item);

            if (context.newGroup) {
                item += '<div class="k-group">' + this.templates.groupTemplate(context.group) + '</div>';
            }

            return item + "</li>";
        },

        refresh: function() {
            this._angularItems("cleanup");

            var html = "";

            var idx = 0;
            var context;
            var dataContext = [];
            var view = this.dataSource.view();
            var values = this._values.slice(0);

            if (!!this.dataSource.group().length) {
                for (var i = 0; i < view.length; i++) {
                    var group = view[i];
                    var newGroup = true;

                    for (var j = 0; j < group.items.length; j++) {
                        context = { item: group.items[j], group: group.value, newGroup: newGroup, index: idx };
                        dataContext[idx] = context;
                        idx += 1;

                        html += this._renderItem(context, values);
                        newGroup = false;
                    }
                }
                //grouped
            } else {
                for (var i = 0; i < view.length; i++) {
                    context = { item: view[i], index: i };

                    dataContext[i] = context;

                    html += this._renderItem(context, values);
                }
            }

            this._dataContext = dataContext;

            this.element[0].innerHTML = html; //could be changed with DOM elements creation

            this._angularItems("compile");

            this.trigger("listBound");
        }
    });

    ui.plugin(StaticList);

    function inArray(node, parentNode) {
        var idx, length, siblings = parentNode.children;

        if (!node || node.parentNode !== parentNode) {
            return -1;
        }

        for (idx = 0, length = siblings.length; idx < length; idx++) {
            if (node === siblings[idx]) {
                return idx;
            }
        }

        return -1;
    }

    function removeFiltersForField(expression, field) {
        var filters;
        var found = false;

        if (expression.filters) {
            filters = $.grep(expression.filters, function(filter) {
                found = removeFiltersForField(filter, field);
                if (filter.filters) {
                    return filter.filters.length;
                } else {
                    return filter.field != field;
                }
            });

            if (!found && expression.filters.length !== filters.length) {
                found = true;
            }

            expression.filters = filters;
        }

        return found;
    }
})(window.kendo.jQuery);

return window.kendo;

}, typeof define == 'function' && define.amd ? define : function(_, f){ f(); });
