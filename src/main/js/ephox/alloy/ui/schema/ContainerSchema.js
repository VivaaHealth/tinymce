define(
  'ephox.alloy.ui.schema.ContainerSchema',

  [
    'ephox.boulder.api.FieldSchema',
    'ephox.peanut.Fun'
  ],

  function (FieldSchema, Fun) {
    return {
      name: Fun.constant('Container'),
      schema: Fun.constant([ ]),
      parts: Fun.constant([ ])
    };
  }
);