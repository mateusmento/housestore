import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/views/ProductsView.vue'),
      children: [
        {
          path: '/:id',
          props: true,
          component: () => import('@/views/ProductView.vue'),
        }
      ]
    },
  ]
})

export default router
