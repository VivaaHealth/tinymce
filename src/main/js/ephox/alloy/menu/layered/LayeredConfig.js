define(
  'ephox.alloy.menu.layered.LayeredConfig',

  [
    'ephox.alloy.alien.ComponentStructure',
    'ephox.alloy.alien.EditableFields',
    'ephox.alloy.api.SystemEvents',
    'ephox.alloy.api.behaviour.Highlighting',
    'ephox.alloy.api.behaviour.Keying',
    'ephox.alloy.api.behaviour.Positioning',
    'ephox.alloy.api.behaviour.Representing',
    'ephox.alloy.construct.EventHandler',
    'ephox.alloy.menu.layered.LayeredState',
    'ephox.alloy.menu.logic.HotspotViews',
    'ephox.alloy.menu.util.ItemEvents',
    'ephox.alloy.menu.util.MenuEvents',
    'ephox.alloy.menu.util.MenuMarkers',
    'ephox.alloy.sandbox.Manager',
    'ephox.boulder.api.FieldPresence',
    'ephox.boulder.api.FieldSchema',
    'ephox.boulder.api.Objects',
    'ephox.boulder.api.ValueSchema',
    'ephox.compass.Arr',
    'ephox.compass.Obj',
    'ephox.highway.Merger',
    'ephox.peanut.Fun',
    'ephox.perhaps.Option',
    'ephox.perhaps.Options',
    'ephox.sugar.api.Body',
    'ephox.sugar.api.Class',
    'ephox.sugar.api.Classes',
    'ephox.sugar.api.Insert',
    'ephox.sugar.api.Remove',
    'ephox.sugar.api.SelectorFilter'
  ],

  function (ComponentStructure, EditableFields, SystemEvents, Highlighting, Keying, Positioning, Representing, EventHandler, LayeredState, HotspotViews, ItemEvents, MenuEvents, MenuMarkers, Manager, FieldPresence, FieldSchema, Objects, ValueSchema, Arr, Obj, Merger, Fun, Option, Options, Body, Class, Classes, Insert, Remove, SelectorFilter) {
    var schema = ValueSchema.objOf([
      FieldSchema.strict('lazyHotspot'),

      FieldSchema.strict('onOpen'),
      FieldSchema.strict('onClose'),
      FieldSchema.strict('onExecute'),
      FieldSchema.defaulted('fakeFocus', false),


      FieldSchema.strict('sink'),

      FieldSchema.field(
        'markers',
        'markers',
        FieldPresence.strict(),
        MenuMarkers.schema()
      ),

      FieldSchema.strict('backgroundClass'),

      FieldSchema.field(
        'members',
        'members',
        FieldPresence.strict(),
        ValueSchema.objOf([
          FieldSchema.strict('menu'),
          FieldSchema.strict('item')
        ])
      ),

      FieldSchema.strict('onHighlight')
    ]);
    
    return function (rawUiSpec) {
      var uiSpec = ValueSchema.asStructOrDie('LayeredConfig', schema, rawUiSpec);

      var buildMenus = function (sandbox, menus) {
        return Obj.map(menus, function (spec, name) {
          // NOTE: We use rawUiSpec here so the nesting isn't a struct
          var data = Merger.deepMerge(
            uiSpec.members().menu().munge(spec),
            {
              uiType: 'menu',
              value: name,
              items: spec.items,
              markers: rawUiSpec.markers,
              members: {
                item: uiSpec.members().item()
              },
              fakeFocus: uiSpec.fakeFocus(),
              onHighlight: uiSpec.onHighlight()
            }
          );
          return sandbox.getSystem().build(data);
        });
      };

      var toMenuValues = function (sandbox, sMenus) {
        return Obj.map(sMenus, function (menu) {
          var menuItems = SelectorFilter.descendants(menu.element(), '.' + uiSpec.markers().item());
          return Arr.bind(menuItems, function (mi) {
            return sandbox.getSystem().getByDom(mi).map(function (item) {
              return Representing.getValue(item);
            }).fold(Fun.constant([ ]), Arr.pure);
          });
        });
      };

      var addToWorld = function (component, componentMap) {
        var menuCs = Obj.values(componentMap);
        Arr.each(menuCs, component.getSystem().addToWorld);
      };

      var showMenu = function (sandbox, menu) {
        Positioning.position(uiSpec.sink(), {
          anchor: 'hotspot',
          hotspot: uiSpec.lazyHotspot()(),
          bubble: Option.none()
        }, menu);

        uiSpec.onOpen()(sandbox, menu);
      };

      var showSubmenu = function (sandbox, triggerItem, submenu) {
        Positioning.position(uiSpec.sink(), {
          anchor: 'submenu',
          item: triggerItem,
          bubble: Option.none()
        }, submenu);
      };

      var setActiveMenu = function (sandbox, menu) {
        Highlighting.highlight(sandbox, menu);
        Highlighting.getHighlighted(menu).orThunk(function () {
          return Highlighting.getFirst(menu);
        }).each(function (item) {
          sandbox.getSystem().triggerEvent(SystemEvents.focusItem(), item.element(), { });
        });
      };

      var populate = function (sandbox, data) {
        var componentMap = buildMenus(sandbox, data.menus);
        addToWorld(sandbox, componentMap);

        var state = LayeredState();
        
        state.setContents(data.primary, componentMap, data.expansions, function (sMenus) {
          return toMenuValues(sandbox, sMenus);
        });
        state.getPrimary().each(function (primary) {
          if (! Body.inBody(primary.element())) Insert.append(sandbox.element(), primary.element());
        });
        return state;
      };

      var enter = function (sandbox, state) {
        state.getPrimary().each(function (primary) {
          setActiveMenu(sandbox, primary);
          showMenu(sandbox, primary);
          Keying.focusIn(sandbox);
        });
      };

      var preview = function (sandbox, state) {
        state.getPrimary().each(function (primary) {
          showMenu(sandbox, primary);
        });
      };

      var clear = function (sandbox, state) {
        var menus = state.getMenus();
        Obj.each(menus, function (comp, menuName) {
          sandbox.getSystem().removeFromWorld(comp);
        });
        state.clear();
      };

      var isPartOf = function (sandbox, state, queryElem) {
        var menus = Obj.values(state.getMenus());
        return Arr.exists(menus, function (m) {
          return ComponentStructure.isPartOf(m, queryElem);
        });
      };

      var getMenus = function (state, menuValues) {
        return Options.cat(
          Arr.map(menuValues, state.lookupMenu)
        );
      };

      var updateMenuPath = function (component, state, path) {
        return Option.from(path[0]).bind(state.lookupMenu).map(function (newMenuComp) {
          var rest = getMenus(state, path.slice(1));
          Arr.each(rest, function (r) {
            Class.add(r.element(), uiSpec.backgroundClass());
          });
          if (! Body.inBody(newMenuComp.element())) {
            Insert.append(component.element(), newMenuComp.element());
          }
          setActiveMenu(component, newMenuComp);
          var others = getMenus(state, state.otherMenus(path));
          Arr.each(others, function (o) {
            // May not need to do the active menu thing.
            Classes.remove(o.element(), [ uiSpec.backgroundClass() ]);
            Remove.remove(o.element());
          });

          return true;
        });
      };

      var expandRight = function (sandbox, item) {
        var value = Representing.getValue(item);
        return sandbox.apis().getState().bind(function (state) {
          return state.expand(value).bind(function (path) {
            // When expanding, always select the first.
            Option.from(path[0]).bind(state.lookupMenu).each(function (newMenuComp) {
              Highlighting.highlightFirst(newMenuComp);

              // DUPE with above. Fix later.
              if (! Body.inBody(newMenuComp.element())) {
                Insert.append(sandbox.element(), newMenuComp.element());
                showSubmenu(sandbox, item, newMenuComp);
              }
            });

            return updateMenuPath(sandbox, state, path);
          });
        });
      };

      var collapseLeft = function (sandbox, item) {
        var value = Representing.getValue(item);
        return sandbox.apis().getState().bind(function (state) {
          return state.collapse(value).bind(function (path) {
            return updateMenuPath(sandbox, state, path);
          });
        });
      };

      var updateView = function (sandbox, item) {
        var value = Representing.getValue(item);
        return sandbox.apis().getState().bind(function (state) {
          return state.refresh(value).bind(function (path) {
            return updateMenuPath(sandbox, state, path);
          });
        });
      };

      var onRight = function (sandbox, triggerItem) {
        return sandbox.getSystem().getByDom(triggerItem).bind(function (item) {
          return EditableFields.inside(triggerItem) ? Option.none() : expandRight(sandbox, item);
        });
      };

      var onLeft = function (sandbox, target) {
        return sandbox.getSystem().getByDom(target).bind(function (item) {
          // Exclude inputs, textareas etc.
          return EditableFields.inside(target) ? Option.none() : collapseLeft(sandbox, item);
        });
      };

      var onEscape = function (sandbox, target) {
        return sandbox.getSystem().getByDom(target).bind(function (item) {
          return collapseLeft(sandbox, item).orThunk(function () {
          // This should only fire when the user presses ESC ... not any other close.
            return HotspotViews.onEscape(uiSpec.lazyHotspot()(), sandbox);
          });
        });
      };

      var events = Objects.wrapAll([
        {
          key: MenuEvents.focus(),
          value: EventHandler.nu({
            // Set "active-menu" for the menu with focus
            run: function (sandbox, simulatedEvent) {
              var menu = simulatedEvent.event().menu();
              Highlighting.highlight(sandbox, menu);
            }
          })
        },
        {
          key: ItemEvents.hover(),
          value: EventHandler.nu({
            // Hide any irrelevant submenus and expand any submenus based 
            // on hovered item
            run: function (sandbox, simulatedEvent) {
              var item = simulatedEvent.event().item();
              updateView(sandbox, item);
              expandRight(sandbox, item);
            }
          })
        },
        {
          key: SystemEvents.execute(),
          value: EventHandler.nu({
            run: function (sandbox, simulatedEvent) {
              // Trigger on execute on the targeted element
              // I.e. clicking on menu item
              var target = simulatedEvent.event().target();
              return sandbox.getSystem().getByDom(target).bind(function (item) {
                return expandRight(sandbox, item).orThunk(function () {
                  return uiSpec.onExecute()(sandbox, item);
                });
              });
            }
          })
        }
      ]);

      var focusManager = {
        set: function (sandbox, element) {
          sandbox.getSystem().getByDom(element).fold(Fun.noop, function (item) {
            Highlighting.getHighlighted(sandbox).each(function (menu) {
              Highlighting.highlight(menu, item);
            });
          });          
        },
        get: function (sandbox) {
          return Highlighting.getHighlighted(sandbox).bind(function (menu) {
            return Highlighting.getHighlighted(menu).map(function (item) {
              return item.element();
            });
          });
        }
      };

      return {
        sandboxing: {
          manager: Manager.contract({
            clear: clear,
            isPartOf: isPartOf,
            populate: populate,
            preview: preview,
            enter: enter
          }),
          onClose: uiSpec.onClose(),
          sink: uiSpec.sink()
        },
        keying: {
          mode: 'menu',
          selector: [ '.' + uiSpec.markers().selectedMenu(), '.' + uiSpec.markers().item() ].join(' '),
          onRight: onRight,
          onLeft: onLeft,
          onEscape: onEscape,
          moveOnTab: true,
          focusManager: uiSpec.fakeFocus() ? focusManager : undefined
        },
        // Highlighting is used for highlighting the active menu
        highlighting: {
          highlightClass: uiSpec.markers().selectedMenu(),
          itemClass: uiSpec.markers().menu()
        },
        events: events
      };
    };
  }
);