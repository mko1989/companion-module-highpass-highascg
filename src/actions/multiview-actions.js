/**
 * @file multiview-actions.js
 * Multiview layout selection action.
 */

export default function (instance) {
  return {
    multiview_apply: {
      name: "Multiview: Apply layout",
      options: [
        {
          type: "number",
          id: "multiviewer_index",
          label: "Multiviewer index (1 = main, optional)",
          default: 1,
          min: 1,
          max: 8,
        },
        {
          type: "textinput",
          id: "layout",
          label: "Layout JSON (array of cells with source/dest routing)",
          default: "[]",
        },
      ],
      callback: async (action) => {
        if (!instance.bridge?.api) return;
        try {
          let layout = [];
          const layoutStr = String(action.options.layout || "").trim();
          if (layoutStr) {
            try {
              layout = JSON.parse(layoutStr);
            } catch (e) {
              instance.log("warn", `Multiview layout parse error: ${e.message || e}`);
              return;
            }
          }
          if (!Array.isArray(layout)) {
            instance.log("warn", "Multiview layout must be an array");
            return;
          }
          const n = Math.max(1, parseInt(action.options.multiviewer_index, 10) || 1);
          const body = { layout };
          if (n > 1) body.n = n;
          await instance.bridge.api.multiviewApply(layout);
        } catch (e) {
          instance.log("error", `Multiview apply: ${e.message || e}`);
        }
      },
    },
  };
}
