// ffs/wizard module
if (typeof turbo === "undefined") turbo={};
turbo.ffs = function() {
  var ffs = {};

  ffs.construct_query = function(ffs) {
    try {
      ffs = turbo.ffs.parser.parse(ffs);
    } catch(e) {
      alert("parse error :(");
      return false;
    }

    var query_parts = [];
    var bounds_part;

    query_parts.push('<osm-script output="json" timeout="25">');

    switch(ffs.bounds) {
      case "area": 
        query_parts.push('  <id-query {{nominatimArea:'+ffs.area+'}} into="area"/>');
        bounds_part = '<area-query from="area"/>';
      break;
      case "around":
        alert("not yet implemented :(");
        return false;
      break;
      case "bbox":
        bounds_part = '<bbox-query {{bbox}}/>';
      break;
      case "global":
        bounds_part = undefined;
      break;
      default:
        alert("unknown bounds condition: "+ffs.bounds);
        return false;
      break;
    }

    function normalize(query) {
      var normalized_query = {
        logical:"or",
        queries:[]
      };
      function normalize_recursive(rem_query) {
        if (!rem_query.logical) {
          return [{
            logical: "and",
            queries: [rem_query]
          }];
        } else if (rem_query.logical === "and") {
          var c1 = normalize_recursive( rem_query.queries[0] );
          var c2 = normalize_recursive( rem_query.queries[1] );
          // return cross product of c1 and c2
          var c = [];
          for (var i=0; i<c1.length; i++)
            for (var j=0; j<c2.length; j++) {
              c.push({
                logical: "and",
                queries: c1[i].queries.concat(c2[j].queries)
              });
            }
          return c;
        } else if (rem_query.logical === "or") {
          var c1 = normalize_recursive( rem_query.queries[0] );
          var c2 = normalize_recursive( rem_query.queries[1] );
          return [].concat(c1,c2);
          /*for (var i=0; i<rem_query.queries.length; i++) {
            normalize_recursive(conditions.concat([rem_query.queries[i]]));
          }*/
        }
      }
      normalized_query.queries = normalize_recursive(query);
      return normalized_query;
    }
    function get_query_clause(condition) {
      switch(condition.query) {
        case "key":
          return '<has-kv k="'+condition.key+'"/>';
        case "nokey":
          return '<has-kv k="'+condition.key+'" modv="not" regv="."/>';
        case "eq":
          return '<has-kv k="'+condition.key+'" v="'+condition.val+'"/>';
        case "neq":
          return '<has-kv k="'+condition.key+'" modv="not" v="'+condition.val+'"/>';
        case "like":
          // todo: case sensitivity?
          return '<has-kv k="'+condition.key+'" regv="'+condition.val+'"/>';
        case "meta":
          switch(condition.meta) {
            case "id":
              return function(type) {
                return '<id-query type="'+type+'" ref="'+condition.val+'"/>';
              };
            case "newer":
              return '<newer than="'+condition.val+'"/>';
            case "user":
              return '<user name="'+condition.val+'"/>';
            case "uid":
              return '<user uid="'+condition.val+'"/>';
            default:
              alert("unknown query type: meta/"+condition.meta);
          }
        // todo: not like !~ operator
        default:
          alert("unknown query type: "+condition.query);
          return false;
      }
    }

    ffs.query = normalize(ffs.query);

    query_parts.push('  <union>');
    for (var i=0; i<ffs.query.queries.length; i++) {
      var and_query = ffs.query.queries[i];

      var types = ['node','way','relation'];
      var clauses = [];
      for (var j=0; j<and_query.queries.length; j++) {
        var cond_query = and_query.queries[j];
        if (cond_query.query === "type")
          types = types.indexOf(cond_query.type) != -1 ? [cond_query.type] : [];
        else {
          var clause = get_query_clause(cond_query);
          if (clause === false) return false;
          clauses.push(clause);
        }
      }

      // construct query
      query_parts.push('    <union>'); // todo: really need this stacking?
      for (var t=0; t<types.length; t++) {
        query_parts.push('      <query type="'+types[t]+'">');
        for (var c=0; c<clauses.length; c++)
          if (typeof clauses[c] !== "function")
            query_parts.push('        '+clauses[c]);
          else
            query_parts.push('        '+clauses[c](types[t]));
        if (bounds_part)
          query_parts.push('        '+bounds_part);
        query_parts.push('      </query>');
      }
      query_parts.push('    </union>');
    }
    query_parts.push('  </union>');

    query_parts.push('  <print mode="body"/>');
    query_parts.push('  <recurse type="down"/>');
    query_parts.push('  <print mode="skeleton" order="quadtile"/>');

    query_parts.push('</osm-script>');

    return query_parts.join('\n');
  }

  return ffs;
}