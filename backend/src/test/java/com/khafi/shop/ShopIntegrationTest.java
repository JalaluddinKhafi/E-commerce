package com.khafi.shop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:shop-tests;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
    "spring.jpa.hibernate.ddl-auto=create-drop", "shop.admin-email=", "shop.admin-password="
})
@AutoConfigureMockMvc
class ShopIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired Customers customers;
    @Autowired Products products;
    @Autowired Carts carts;
    @Autowired Orders orders;
    @Autowired SavedProducts saved;
    @Autowired DeliveryAddresses addresses;
    @Autowired PasswordEncoder passwords;
    Product product;

    @BeforeEach void fixtures() {
        saved.deleteAll(); addresses.deleteAll(); carts.deleteAll(); orders.deleteAll(); customers.deleteAll(); products.deleteAll();
        product = product("Carrots", 399, 10);
    }
    Product product(String name, int price, int stock) {
        var p = new Product(); p.name=name; p.description="Fresh from the farm"; p.category="Vegetables";
        p.image="/images/img-pro-01.jpg"; p.priceCents=price; p.stock=stock;
        return products.save(p);
    }
    MvcResult call(String method, String path, String token, Object body) throws Exception {
        var request = switch (method) {
            case "POST" -> post(path); case "PUT" -> put(path); case "PATCH" -> patch(path);
            case "DELETE" -> delete(path); default -> get(java.net.URI.create(path));
        };
        request.contentType(MediaType.APPLICATION_JSON);
        if (token != null) request.header("Authorization", "Bearer " + token);
        if (body != null) request.content(json.writeValueAsBytes(body));
        return mvc.perform(request).andReturn();
    }
    JsonNode body(MvcResult result) throws Exception { return json.readTree(result.getResponse().getContentAsString()); }
    String register(String email) throws Exception {
        var result = call("POST", "/api/auth/register", null, Map.of("name", "Test customer", "email", email, "password", "Long-test-password1!"));
        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        return body(result).get("token").asText();
    }
    String admin() throws Exception {
        var a = new Customer(); a.name="Admin"; a.email="admin@example.test"; a.role="ADMIN"; a.passwordHash=passwords.encode("Long-test-password1!");
        customers.save(a);
        return body(call("POST", "/api/auth/login", null, Map.of("email", a.email, "password", "Long-test-password1!"))).get("token").asText();
    }
    void cart(String token, Product p, int quantity) throws Exception {
        assertThat(call("PUT", "/api/cart/" + p.id, token, Map.of("quantity", quantity)).getResponse().getStatus()).isEqualTo(200);
    }
    Map<String, Object> checkout(UUID key) { return Map.of("address", "Kabul, Test Street 10", "phone", "+93700000000", "requestKey", key.toString()); }

    Map<String, Object> delivery(String label, boolean isDefault) {
        return Map.of("label", label, "recipient", "Recipient A", "phone", "+93700000000", "address", "Street 10, Kabul", "isDefault", isDefault);
    }
    @Test void wishlistsArePrivatePersistentAndIdempotent() throws Exception {
        assertThat(call("GET", "/api/wishlist", null, null).getResponse().getStatus()).isEqualTo(401);
        String one=register("one@example.test"), two=register("two@example.test");
        for (int i=0;i<2;i++) assertThat(call("PUT", "/api/wishlist/"+product.id, one, null).getResponse().getStatus()).isEqualTo(200);
        assertThat(saved.count()).isEqualTo(1);
        assertThat(body(call("GET", "/api/wishlist", one, null)).get(0).get("name").asText()).isEqualTo("Carrots");
        assertThat(body(call("GET", "/api/wishlist", two, null)).size()).isZero();
        call("DELETE", "/api/wishlist/"+product.id, two, null);
        assertThat(saved.count()).isEqualTo(1);
        String login=body(call("POST", "/api/auth/login", null, Map.of("email", "one@example.test", "password", "Long-test-password1!"))).get("token").asText();
        assertThat(body(call("GET", "/api/wishlist", login, null)).size()).isEqualTo(1);
        product.active=false; products.save(product);
        assertThat(body(call("GET", "/api/wishlist", login, null)).get(0).get("active").asBoolean()).isFalse();
        for (int i=0;i<2;i++) assertThat(call("DELETE", "/api/wishlist/"+product.id, login, null).getResponse().getStatus()).isEqualTo(200);
        assertThat(saved.count()).isZero();
    }
    @Test void wishlistImportMergesAndSkipsUnavailableIdsWithoutPrivilegeInjection() throws Exception {
        String user=register("user@example.test");
        Product other=product("Other",500,5), hidden=product("Hidden",600,4);
        hidden.active=false; products.save(hidden);
        call("PUT", "/api/wishlist/"+product.id, user, null);
        var data=Map.of("productIds", List.of(product.id,product.id,other.id,hidden.id,999999L));
        assertThat(body(call("POST", "/api/wishlist/import", user, data)).size()).isEqualTo(2);
        assertThat(body(call("POST", "/api/wishlist/import", user, data)).size()).isEqualTo(2);
        assertThat(call("POST", "/api/wishlist/import", user, Map.of("productIds", List.of(-1))).getResponse().getStatus()).isEqualTo(400);
        assertThat(call("POST", "/api/wishlist/import", user, Map.of("productIds", Collections.nCopies(101,product.id))).getResponse().getStatus()).isEqualTo(400);
        assertThat(call("POST", "/api/wishlist/import", user, Map.of("productIds", List.of(product.id), "customerId", 9)).getResponse().getStatus()).isEqualTo(400);
        assertThat(call("PUT", "/api/wishlist/"+hidden.id, user, null).getResponse().getStatus()).isEqualTo(404);
    }
    @Test void wishlistCapacityIsEnforcedWithoutPartialImports() throws Exception {
        String user=register("user@example.test"); Customer customer=customers.findByEmail("user@example.test").orElseThrow();
        List<SavedProduct> entries=new ArrayList<>();
        for(int i=0;i<100;i++) {
            Product p=i==0?product:product("Saved "+i,100,5);
            var entry=new SavedProduct(); entry.customer=customer; entry.product=p; entries.add(entry);
        }
        saved.saveAllAndFlush(entries);
        Product extra=product("Extra",300,1);
        assertThat(call("PUT", "/api/wishlist/"+extra.id, user, null).getResponse().getStatus()).isEqualTo(409);
        assertThat(call("POST", "/api/wishlist/import", user, Map.of("productIds", List.of(extra.id))).getResponse().getStatus()).isEqualTo(409);
        assertThat(saved.count()).isEqualTo(100);
        call("DELETE", "/api/wishlist/"+product.id, user, null);
        assertThat(call("PUT", "/api/wishlist/"+extra.id, user, null).getResponse().getStatus()).isEqualTo(200);
    }
    @Test void deliveryAddressesAreOwnedByAuthenticatedAccount() throws Exception {
        assertThat(call("GET", "/api/account/addresses", null, null).getResponse().getStatus()).isEqualTo(401);
        String owner=register("owner@example.test"), other=register("other@example.test");
        var result=call("POST", "/api/account/addresses", owner, delivery("Home",false));
        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        long id=body(result).get("id").asLong();
        assertThat(body(result).get("isDefault").asBoolean()).isTrue();
        assertThat(body(call("GET", "/api/account/addresses", other, null)).size()).isZero();
        assertThat(call("PUT", "/api/account/addresses/"+id, other, delivery("Stolen",true)).getResponse().getStatus()).isEqualTo(404);
        assertThat(call("DELETE", "/api/account/addresses/"+id, other, null).getResponse().getStatus()).isEqualTo(404);
        assertThat(addresses.count()).isEqualTo(1);
    }
    @Test void addressDefaultIsUniqueAndPromotedOnDeletion() throws Exception {
        String user=register("user@example.test");
        long first=body(call("POST", "/api/account/addresses", user, delivery("Home",false))).get("id").asLong();
        long second=body(call("POST", "/api/account/addresses", user, delivery("Office",true))).get("id").asLong();
        var list=body(call("GET", "/api/account/addresses", user, null));
        assertThat(list.get(0).get("isDefault").asBoolean()).isFalse();
        assertThat(list.get(1).get("isDefault").asBoolean()).isTrue();
        var update=call("PUT", "/api/account/addresses/"+second, user, delivery("Office updated",false));
        assertThat(body(update).get("isDefault").asBoolean()).isTrue();
        assertThat(call("DELETE", "/api/account/addresses/"+second, user, null).getResponse().getStatus()).isEqualTo(204);
        assertThat(body(call("GET", "/api/account/addresses", user, null)).get(0).get("isDefault").asBoolean()).isTrue();
        call("DELETE", "/api/account/addresses/"+first, user, null);
    @Test void catalogFiltersAndPaginatesOnTheServer() throws Exception {
        Product apple=product("Apple",500,4); apple.category="Fruit"; products.save(apple);
        Product grape=product("Grape",700,4); grape.category="Fruit"; products.save(grape);
        Product hidden=product("Hidden fruit",900,4); hidden.category="Fruit"; hidden.active=false; products.save(hidden);
        var first=call("GET", "/api/catalog?category=fruit&sort=high&size=1&page=0", null, null);
        assertThat(first.getResponse().getStatus()).isEqualTo(200);
        var data=body(first);
        assertThat(data.get("items").get(0).get("name").asText()).isEqualTo("Grape");
        assertThat(data.get("totalElements").asInt()).isEqualTo(2);
        assertThat(data.get("totalPages").asInt()).isEqualTo(2);
        assertThat(data.get("categories").toString()).isEqualTo("[\"Fruit\",\"Vegetables\"]");
        var second=body(call("GET", "/api/catalog?category=fruit&sort=high&size=1&page=1", null, null));
        assertThat(second.get("items").get(0).get("name").asText()).isEqualTo("Apple");
        assertThat(body(call("GET", "/api/catalog?category=fruit&size=1&page=2", null, null)).get("items").size()).isZero();
        assertThat(body(call("GET", "/api/catalog?q=cArRoTs", null, null)).get("totalElements").asInt()).isEqualTo(1);
    }
    @Test void catalogTreatsWildcardCharactersAsLiteralSearchText() throws Exception {
        product("100% organic",500,4); product("C_Leaf",600,4);
        var percent=body(call("GET", "/api/catalog?q=%25", null, null));
        assertThat(percent.get("totalElements").asInt()).isEqualTo(1);
        assertThat(percent.get("items").get(0).get("name").asText()).isEqualTo("100% organic");
        var underscore=body(call("GET", "/api/catalog?q=_", null, null));
        assertThat(underscore.get("totalElements").asInt()).isEqualTo(1);
        assertThat(underscore.get("items").get(0).get("name").asText()).isEqualTo("C_Leaf");
    }
    @Test void catalogRejectsInvalidBoundsAndUsesStableSortTies() throws Exception {
        Product other=product("Other carrots",399,4);
        for (String parameters : List.of("size=0", "size=49", "page=-1", "page=100001", "sort=unknown", "q="+"a".repeat(121), "category="+"a".repeat(61)))
            assertThat(call("GET", "/api/catalog?"+parameters, null, null).getResponse().getStatus()).isEqualTo(400);
        var data=body(call("GET", "/api/catalog?sort=low", null, null));
        assertThat(data.get("items").get(0).get("id").asLong()).isEqualTo(product.id);
        assertThat(data.get("items").get(1).get("id").asLong()).isEqualTo(other.id);
    }
    @Test void publicCatalogAndPrivateResources() throws Exception {
        var result = call("GET", "/api/products", null, null);
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        assertThat(body(result).get(0).get("name").asText()).isEqualTo("Carrots");
        for (String path : List.of("/api/cart", "/api/orders", "/api/admin/products", "/api/auth/me"))
            assertThat(call("GET", path, null, null).getResponse().getStatus()).isEqualTo(401);
        assertThat(call("GET", "/api/products/999999", null, null).getResponse().getStatus()).isEqualTo(404);
    }
    @Test void registrationHashingAndLogin() throws Exception {
        var token = register("USER@example.test");
        Customer user = customers.findByEmail("user@example.test").orElseThrow();
        assertThat(user.passwordHash).isNotEqualTo("Long-test-password1!");
        assertThat(passwords.matches("Long-test-password1!", user.passwordHash)).isTrue();
        assertThat(body(call("GET", "/api/auth/me", token, null)).get("role").asText()).isEqualTo("USER");
        assertThat(call("POST", "/api/auth/login", null, Map.of("email", "USER@example.test", "password", "Long-test-password1!")).getResponse().getStatus()).isEqualTo(200);
        assertThat(call("POST", "/api/auth/login", null, Map.of("email", "user@example.test", "password", "wrong-password")).getResponse().getStatus()).isEqualTo(401);
        assertThat(call("POST", "/api/auth/register", null, Map.of("name", "Other", "email", "user@example.test", "password", "Long-test-password1!")).getResponse().getStatus()).isEqualTo(409);
    }
    @Test void rejectsInvalidRegistrationAndPrivilegeInjection() throws Exception {
        assertThat(call("POST", "/api/auth/register", null, Map.of("name", " ", "email", "bad", "password", "short")).getResponse().getStatus()).isEqualTo(400);
        assertThat(call("POST", "/api/auth/register", null, Map.of("name", "User", "email", "user@example.test", "password", "Long-test-password1!", "role", "ADMIN")).getResponse().getStatus()).isEqualTo(400);
        assertThat(customers.count()).isZero();
    }
    @Test void cartIsPrivateAndValidatesQuantity() throws Exception {
        String first=register("first@example.test"), second=register("second@example.test");
        cart(first, product, 2);
        JsonNode own = body(call("GET", "/api/cart", first, null));
        assertThat(own.get("items").get(0).get("product").get("name").asText()).isEqualTo("Carrots");
        assertThat(own.get("subtotalCents").asInt()).isEqualTo(798);
        assertThat(own.get("shippingCents").asInt()).isEqualTo(500);
        assertThat(body(call("GET", "/api/cart", second, null)).get("items").size()).isZero();
        for (int quantity : List.of(-1, 100))
            assertThat(call("PUT", "/api/cart/"+product.id, first, Map.of("quantity", quantity)).getResponse().getStatus()).isEqualTo(400);
        assertThat(call("PUT", "/api/cart/"+product.id, first, Map.of("quantity", 11)).getResponse().getStatus()).isEqualTo(409);
        cart(first, product, 0);
        assertThat(carts.count()).isZero();
    }
    @Test void checkoutUsesServerPricesAndIsIdempotent() throws Exception {
        String user=register("user@example.test"); cart(user, product, 2);
        product.priceCents=599; products.save(product);
        UUID key=UUID.randomUUID();
        var first=call("POST", "/api/orders", user, checkout(key));
        assertThat(first.getResponse().getStatus()).isEqualTo(201);
        assertThat(body(first).get("subtotalCents").asInt()).isEqualTo(1198);
        assertThat(body(first).get("totalCents").asInt()).isEqualTo(1698);
        var retry=call("POST", "/api/orders", user, checkout(key));
        assertThat(body(retry).get("id")).isEqualTo(body(first).get("id"));
        assertThat(orders.count()).isEqualTo(1); assertThat(carts.count()).isZero();
        assertThat(products.findById(product.id).orElseThrow().stock).isEqualTo(8);
        assertThat(call("POST", "/api/orders", user, checkout(UUID.randomUUID())).getResponse().getStatus()).isEqualTo(409);
        assertThat(body(call("GET", "/api/orders", register("other@example.test"), null)).size()).isZero();
    }
    @Test void failedCheckoutRollsBackAllStock() throws Exception {
        String user=register("user@example.test"); Product other=product("Tomatoes", 500, 5);
        cart(user, product, 2); cart(user, other, 2);
        other.stock=1; products.save(other);
        assertThat(call("POST", "/api/orders", user, checkout(UUID.randomUUID())).getResponse().getStatus()).isEqualTo(409);
        assertThat(products.findById(product.id).orElseThrow().stock).isEqualTo(10);
        assertThat(carts.count()).isEqualTo(2); assertThat(orders.count()).isZero();
    }
    @Test void adminsControlInventoryAndStatusWithoutCustomerEscalation() throws Exception {
        String user=register("user@example.test"), admin=admin();
        assertThat(call("GET", "/api/admin/products", user, null).getResponse().getStatus()).isEqualTo(403);
        cart(user, product, 1);
        var placed=body(call("POST", "/api/orders", user, checkout(UUID.randomUUID())));
        String path="/api/admin/orders/" + placed.get("id").asLong();
        assertThat(call("PATCH", path, user, Map.of("status", "CANCELLED")).getResponse().getStatus()).isEqualTo(403);
        assertThat(call("PATCH", path, admin, Map.of("status", "DELIVERED")).getResponse().getStatus()).isEqualTo(409);
        assertThat(call("PATCH", path, admin, Map.of("status", "CANCELLED")).getResponse().getStatus()).isEqualTo(200);
        assertThat(products.findById(product.id).orElseThrow().stock).isEqualTo(10);
        call("PATCH", path, admin, Map.of("status", "CANCELLED"));
        assertThat(products.findById(product.id).orElseThrow().stock).isEqualTo(10);
        assertThat(call("PATCH", path, admin, Map.of("status", "PROCESSING")).getResponse().getStatus()).isEqualTo(409);
    }
    @Test void archivedProductsCannotBePurchasedButCanBeRemovedFromCart() throws Exception {
        String user=register("user@example.test"), admin=admin(); cart(user, product, 1);
        assertThat(call("DELETE", "/api/admin/products/"+product.id, admin, null).getResponse().getStatus()).isEqualTo(204);
        assertThat(body(call("GET", "/api/products", null, null)).size()).isZero();
        assertThat(call("POST", "/api/orders", user, checkout(UUID.randomUUID())).getResponse().getStatus()).isEqualTo(409);
        cart(user, product, 0);
    }
    @Test void expensiveOrdersReceiveFreeShipping() throws Exception {
        String user=register("user@example.test"); product.priceCents=2500; products.save(product); cart(user, product, 2);
        assertThat(body(call("POST", "/api/orders", user, checkout(UUID.randomUUID()))).get("shippingCents").asInt()).isZero();
    }
    @Test void changedPricesRequireConfirmationAndRollbackStock() throws Exception {
        String user=register("user@example.test"); cart(user, product, 2);
        var data=new HashMap<String, Object>(checkout(UUID.randomUUID()));
        data.put("expectedTotalCents", 1);
        assertThat(call("POST", "/api/orders", user, data).getResponse().getStatus()).isEqualTo(409);
        assertThat(products.findById(product.id).orElseThrow().stock).isEqualTo(10);
        assertThat(orders.count()).isZero(); assertThat(carts.count()).isEqualTo(1);
        assertThat(call("PUT", "/api/cart/"+product.id, user, Collections.singletonMap("quantity", null)).getResponse().getStatus()).isEqualTo(400);
    }
    @Test void profileEditsAreValidatedAndScopedToCurrentAccount() throws Exception {
        String first=register("first@example.test"), second=register("second@example.test");
        var updated=call("PUT", "/api/account/profile", first, Map.of("name", "  Updated name  "));
        assertThat(updated.getResponse().getStatus()).isEqualTo(200);
        assertThat(body(updated).get("name").asText()).isEqualTo("Updated name");
        assertThat(body(call("GET", "/api/auth/me", second, null)).get("name").asText()).isEqualTo("Test customer");
        assertThat(call("PUT", "/api/account/profile", first, Map.of("name", " ")).getResponse().getStatus()).isEqualTo(400);
        assertThat(call("PUT", "/api/account/profile", first, Map.of("name", "Admin", "role", "ADMIN")).getResponse().getStatus()).isEqualTo(400);
        assertThat(call("PUT", "/api/account/profile", null, Map.of("name", "Name")).getResponse().getStatus()).isEqualTo(401);
    }
    @Test void passwordChangeRevokesEveryOldTokenAndRequiresCurrentPassword() throws Exception {
        String email="user@example.test", old="Long-test-password1!", replacement="New-password-for-account-123!";
        String token=register(email);
        String second=body(call("POST", "/api/auth/login", null, Map.of("email", email, "password", old))).get("token").asText();
        for (Map<String, String> invalid : List.of(
            Map.of("currentPassword", "wrong-password", "newPassword", replacement),
            Map.of("currentPassword", old, "newPassword", old),
            Map.of("currentPassword", old, "newPassword", "ژ".repeat(40))))
            assertThat(call("POST", "/api/account/password", token, invalid).getResponse().getStatus()).isEqualTo(400);
        assertThat(call("GET", "/api/auth/me", token, null).getResponse().getStatus()).isEqualTo(200);
        assertThat(call("POST", "/api/account/password", token, Map.of("currentPassword", old, "newPassword", replacement)).getResponse().getStatus()).isEqualTo(204);
        for (String previous : List.of(token, second))
            assertThat(call("GET", "/api/auth/me", previous, null).getResponse().getStatus()).isEqualTo(401);
        assertThat(call("POST", "/api/auth/login", null, Map.of("email", email, "password", old)).getResponse().getStatus()).isEqualTo(401);
        var login=call("POST", "/api/auth/login", null, Map.of("email", email, "password", replacement));
        assertThat(login.getResponse().getStatus()).isEqualTo(200);
        assertThat(call("GET", "/api/auth/me", body(login).get("token").asText(), null).getResponse().getStatus()).isEqualTo(200);
    }
    @Test void logoutAllRevokesCopiedTokensWithoutDeletingAccount() throws Exception {
        String token=register("user@example.test");
        assertThat(call("POST", "/api/account/logout-all", token, null).getResponse().getStatus()).isEqualTo(204);
        assertThat(call("GET", "/api/cart", token, null).getResponse().getStatus()).isEqualTo(401);
        assertThat(call("POST", "/api/auth/login", null, Map.of("email", "user@example.test", "password", "Long-test-password1!")).getResponse().getStatus()).isEqualTo(200);
        assertThat(customers.count()).isEqualTo(1);
    }
    @Test void oversizedMultibyteLoginPasswordIsAnAuthenticationFailure() throws Exception {
        register("user@example.test");
        assertThat(call("POST", "/api/auth/login", null, Map.of("email", "user@example.test", "password", "ژ".repeat(40))).getResponse().getStatus()).isEqualTo(401);
    }
    @Test void customersCanCancelOnlyTheirOwnPendingOrders() throws Exception {
        String user=register("user@example.test"), other=register("other@example.test"), admin=admin();
        cart(user, product, 2);
        long id=body(call("POST", "/api/orders", user, checkout(UUID.randomUUID()))).get("id").asLong();
        String cancel="/api/orders/"+id+"/cancel";
        assertThat(call("POST", cancel, other, null).getResponse().getStatus()).isEqualTo(404);
        assertThat(products.findById(product.id).orElseThrow().stock).isEqualTo(8);
        assertThat(call("POST", cancel, user, null).getResponse().getStatus()).isEqualTo(200);
        assertThat(call("POST", cancel, user, null).getResponse().getStatus()).isEqualTo(200);
        assertThat(products.findById(product.id).orElseThrow().stock).isEqualTo(10);
        cart(user, product, 1);
        long preparing=body(call("POST", "/api/orders", user, checkout(UUID.randomUUID()))).get("id").asLong();
        call("PATCH", "/api/admin/orders/"+preparing, admin, Map.of("status", "PROCESSING"));
        assertThat(call("POST", "/api/orders/"+preparing+"/cancel", user, null).getResponse().getStatus()).isEqualTo(409);
        assertThat(products.findById(product.id).orElseThrow().stock).isEqualTo(9);
    }
    @Test void concurrentCancellationRestocksOnlyOnce() throws Exception {
        String user=register("user@example.test"); cart(user, product, 2);
        long id=body(call("POST", "/api/orders", user, checkout(UUID.randomUUID()))).get("id").asLong();
        ExecutorService pool=Executors.newFixedThreadPool(2);
        try {
            var gate=new CountDownLatch(1);
            Callable<Integer> cancel=() -> { gate.await(); return call("POST", "/api/orders/"+id+"/cancel", user, null).getResponse().getStatus(); };
            var first=pool.submit(cancel); var second=pool.submit(cancel); gate.countDown();
            assertThat(first.get(20, TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(second.get(20, TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(products.findById(product.id).orElseThrow().stock).isEqualTo(10);
        } finally { pool.shutdownNow(); }
    }
    @Test void concurrentCustomersCannotBuyTheSameLastItem() throws Exception {
        String one=register("one@example.test"), two=register("two@example.test");
        product.stock=1; products.save(product); cart(one, product, 1); cart(two, product, 1);
        ExecutorService pool=Executors.newFixedThreadPool(2);
        try {
            var gate=new CountDownLatch(1);
            var futures=List.of(one, two).stream().map(token -> pool.submit(() -> {
                gate.await(); return call("POST", "/api/orders", token, checkout(UUID.randomUUID())).getResponse().getStatus();
            })).toList();
            gate.countDown();
            assertThat(List.of(futures.get(0).get(20, TimeUnit.SECONDS), futures.get(1).get(20, TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);
            assertThat(products.findById(product.id).orElseThrow().stock).isZero(); assertThat(orders.count()).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
}
